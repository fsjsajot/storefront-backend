import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt.js';

function expiredAccessToken(): string {
  return jwt.sign(
    {
      type: 'access',
      email: 'a@example.com',
      role: 'CUSTOMER',
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    env.jwtAccessSecret,
    { subject: 'user-1' },
  );
}

function expiredRefreshToken(): string {
  return jwt.sign(
    { type: 'refresh', exp: Math.floor(Date.now() / 1000) - 60 },
    env.jwtRefreshSecret,
    { subject: 'user-1' },
  );
}

describe('jwt utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ subject: 'user-1', email: 'a@example.com', role: 'CUSTOMER' });
    const payload = verifyAccessToken(token);
    expect(payload).toEqual({
      sub: 'user-1',
      email: 'a@example.com',
      role: 'CUSTOMER',
      type: 'access',
    });
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('user-1');
    const payload = verifyRefreshToken(token);
    expect(payload).toEqual({ sub: 'user-1', type: 'refresh' });
  });

  it('rejects an access token signed with the wrong secret', () => {
    const token = jwt.sign(
      { type: 'access', email: 'a@example.com', role: 'CUSTOMER' },
      'wrong-secret',
      { subject: 'user-1', expiresIn: 60 },
    );
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a refresh token used as an access token', () => {
    const refresh = jwt.sign({ type: 'refresh' }, env.jwtAccessSecret, {
      subject: 'user-1',
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(refresh)).toThrow(/Invalid access token payload/);
  });

  it('rejects an access token used as a refresh token', () => {
    const access = jwt.sign(
      { type: 'access', email: 'a@example.com', role: 'ADMIN' },
      env.jwtRefreshSecret,
      { subject: 'user-1', expiresIn: 60 },
    );
    expect(() => verifyRefreshToken(access)).toThrow(/Invalid refresh token payload/);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ subject: 'user-1', email: 'a@example.com', role: 'CUSTOMER' });
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}.${signature.slice(0, -1)}${signature.slice(-1) === 'a' ? 'b' : 'a'}`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects an expired access token', () => {
    expect(() => verifyAccessToken(expiredAccessToken())).toThrow(/expired/i);
  });

  it('rejects an expired refresh token', () => {
    expect(() => verifyRefreshToken(expiredRefreshToken())).toThrow(/expired/i);
  });
});
