import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userRepository } from '../repositories/user.repository.js';
import { signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { authService } from './auth.service.js';

vi.mock('./audit.service.js', () => ({
  recordAudit: vi.fn(),
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
  },
}));

vi.mock('../utils/password.js', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

const createUserRow = (
  overrides: Partial<Prisma.UserGetPayload<true>> = {},
): Prisma.UserGetPayload<true> => ({
  id: 'user-1',
  email: 'a@example.com',
  passwordHash: 'hashed-password',
  role: 'CUSTOMER',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createRefreshTokenRow = (
  overrides: Partial<Prisma.RefreshTokenGetPayload<true>> = {},
): Prisma.RefreshTokenGetPayload<true> => ({
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'token-hash',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findUserByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findUserById).mockResolvedValue(null);
    vi.mocked(userRepository.findRefreshTokenByHash).mockResolvedValue(null);
    vi.mocked(userRepository.createUser).mockResolvedValue(createUserRow());
    vi.mocked(userRepository.createRefreshToken).mockResolvedValue(createRefreshTokenRow());
    vi.mocked(userRepository.revokeRefreshToken).mockResolvedValue(undefined);
  });

  describe('register', () => {
    it('creates a user and issues access and refresh tokens', async () => {
      vi.mocked(hashPassword).mockResolvedValue('hashed-password');

      const result = await authService.register({ email: 'a@example.com', password: 'secret123' });

      expect(userRepository.createUser).toHaveBeenCalledWith({
        email: 'a@example.com',
        passwordHash: 'hashed-password',
      });
      expect(userRepository.createRefreshToken).toHaveBeenCalledTimes(1);
      expect(result.user).toMatchObject({ id: 'user-1', email: 'a@example.com', role: 'CUSTOMER' });
      expect(result.accessToken).toBeTruthy();
      expect(verifyRefreshToken(result.refreshToken).sub).toBe('user-1');
    });

    it('rejects a duplicate email', async () => {
      vi.mocked(userRepository.findUserByEmail).mockResolvedValue(createUserRow());

      await expect(
        authService.register({ email: 'a@example.com', password: 'secret123' }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'A user with this email already exists',
      });
      expect(userRepository.createUser).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email on a unique-constraint race', async () => {
      vi.mocked(hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(userRepository.createUser).mockRejectedValue({ code: 'P2002' });

      await expect(
        authService.register({ email: 'a@example.com', password: 'secret123' }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      vi.mocked(userRepository.findUserByEmail).mockResolvedValue(createUserRow());
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await authService.login({ email: 'a@example.com', password: 'secret123' });

      expect(verifyPassword).toHaveBeenCalledWith('secret123', 'hashed-password');
      expect(result.user.email).toBe('a@example.com');
      expect(result.accessToken).toBeTruthy();
    });

    it('rejects an unknown email', async () => {
      await expect(
        authService.login({ email: 'missing@example.com', password: 'secret123' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    });

    it('rejects a wrong password', async () => {
      vi.mocked(userRepository.findUserByEmail).mockResolvedValue(createUserRow());
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(
        authService.login({ email: 'a@example.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token', async () => {
      const oldToken = signRefreshToken('user-1');
      vi.mocked(userRepository.findRefreshTokenByHash).mockResolvedValue(
        createRefreshTokenRow({ id: 'rt-old' }),
      );
      vi.mocked(userRepository.findUserById).mockResolvedValue(createUserRow());
      vi.mocked(userRepository.createRefreshToken).mockResolvedValue(
        createRefreshTokenRow({ id: 'rt-new' }),
      );

      const result = await authService.refresh(oldToken);

      expect(userRepository.revokeRefreshToken).toHaveBeenCalledWith('rt-old');
      expect(userRepository.createRefreshToken).toHaveBeenCalledTimes(1);
      expect(userRepository.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(verifyRefreshToken(result.refreshToken).sub).toBe('user-1');
    });

    it('rejects a revoked refresh token', async () => {
      vi.mocked(userRepository.findRefreshTokenByHash).mockResolvedValue(
        createRefreshTokenRow({ revokedAt: new Date() }),
      );

      await expect(authService.refresh(signRefreshToken('user-1'))).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token',
      });
      expect(userRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('rejects an expired refresh token', async () => {
      vi.mocked(userRepository.findRefreshTokenByHash).mockResolvedValue(
        createRefreshTokenRow({ expiresAt: new Date(Date.now() - 60_000) }),
      );

      await expect(authService.refresh(signRefreshToken('user-1'))).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejects a malformed refresh token', async () => {
      await expect(authService.refresh('not-a-jwt')).rejects.toMatchObject({ statusCode: 401 });
      expect(userRepository.findRefreshTokenByHash).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      vi.mocked(userRepository.findRefreshTokenByHash).mockResolvedValue(createRefreshTokenRow());

      await authService.logout('some-refresh-token');

      expect(userRepository.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
    });

    it('is a no-op when no refresh token is supplied', async () => {
      await authService.logout(undefined);
      await authService.logout('');

      expect(userRepository.findRefreshTokenByHash).not.toHaveBeenCalled();
      expect(userRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });
});
