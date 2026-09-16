import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { userRepository, type UserRow } from '../repositories/user.repository.js';
import { ApiError } from '../utils/api-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { recordAudit, type AuditContext } from './audit.service.js';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface AuthUserView {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthResult {
  user: AuthUserView;
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshExpiresAt: Date;
}

function toView(user: UserRow): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

export async function register(
  input: { email: string; password: string },
  context?: AuditContext,
): Promise<AuthResult> {
  const existing = await userRepository.findUserByEmail(input.email);
  if (existing !== null) {
    throw new ApiError(409, 'A user with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  let user: UserRow;
  try {
    user = await userRepository.createUser({ email: input.email, passwordHash });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ApiError(409, 'A user with this email already exists');
    }
    throw err;
  }

  const result = await issueTokens(user);
  await recordAudit({
    entityType: 'User',
    entityId: user.id,
    action: 'REGISTER',
    actorType: 'USER',
    actorId: user.id,
    metadata: { email: user.email },
    context,
  });
  return result;
}

export async function login(
  input: { email: string; password: string },
  context?: AuditContext,
): Promise<AuthResult> {
  const user = await userRepository.findUserByEmail(input.email);
  if (user === null) {
    await recordAudit({
      entityType: 'User',
      entityId: input.email,
      action: 'LOGIN_FAILED',
      actorType: 'GUEST',
      actorId: null,
      metadata: { email: input.email, reason: 'unknown_email' },
      context,
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN_FAILED',
      actorType: 'GUEST',
      actorId: null,
      metadata: { email: input.email, reason: 'wrong_password' },
      context,
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  const result = await issueTokens(user);
  await recordAudit({
    entityType: 'User',
    entityId: user.id,
    action: 'LOGIN_SUCCESS',
    actorType: 'USER',
    actorId: user.id,
    metadata: { email: user.email },
    context,
  });
  return result;
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let subject: string;
  try {
    subject = verifyRefreshToken(refreshToken).sub;
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const tokenRow = await userRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
  if (
    tokenRow === null ||
    tokenRow.revokedAt !== null ||
    tokenRow.expiresAt.getTime() <= Date.now()
  ) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await userRepository.findUserById(subject);
  if (user === null) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  await userRepository.revokeRefreshToken(tokenRow.id);
  return issueTokens(user);
}

export async function logout(
  refreshToken: string | undefined,
  context?: AuditContext,
): Promise<void> {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return;
  }

  let subject: string | null = null;
  try {
    subject = verifyRefreshToken(refreshToken).sub;
  } catch {
    // Invalid or expired token; still revoke the stored row below if present.
  }

  const tokenRow = await userRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
  if (tokenRow !== null && tokenRow.revokedAt === null) {
    await userRepository.revokeRefreshToken(tokenRow.id);
  }

  await recordAudit({
    entityType: 'User',
    entityId: subject ?? 'unknown',
    action: 'LOGOUT',
    actorType: subject !== null ? 'USER' : 'GUEST',
    actorId: subject,
    context,
  });
}

export async function getMe(userId: string): Promise<AuthUserView> {
  const user = await userRepository.findUserById(userId);
  if (user === null) {
    throw new ApiError(404, 'User not found');
  }
  return toView(user);
}

async function issueTokens(user: UserRow): Promise<AuthResult> {
  const accessToken = signAccessToken({ subject: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id);
  const tokenRow = await userRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + env.jwtRefreshTtl * 1000),
  });
  return {
    user: toView(user),
    accessToken,
    refreshToken,
    refreshTokenId: tokenRow.id,
    refreshExpiresAt: tokenRow.expiresAt,
  };
}

export const authService = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
