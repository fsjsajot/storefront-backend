import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export interface SignAccessTokenInput {
  subject: string;
  email: string;
  role: UserRole;
}

export function signAccessToken(input: SignAccessTokenInput): string {
  return jwt.sign({ email: input.email, role: input.role, type: 'access' }, env.jwtAccessSecret, {
    subject: input.subject,
    expiresIn: env.jwtAccessTtl,
  });
}

export function signRefreshToken(subject: string): string {
  return jwt.sign({ type: 'refresh' }, env.jwtRefreshSecret, {
    subject,
    expiresIn: env.jwtRefreshTtl,
  });
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'CUSTOMER' || value === 'ADMIN';
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret);
  if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }
  if (typeof payload.email !== 'string' || !isUserRole(payload.role)) {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    type: 'access',
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwtRefreshSecret);
  if (
    typeof payload === 'string' ||
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string'
  ) {
    throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  }
  return { sub: payload.sub, type: 'refresh' };
}
