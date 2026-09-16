import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getAuditContext } from '../middleware/audit.js';
import { authService, type AuthResult } from '../services/auth.service.js';
import { ApiError } from '../utils/api-error.js';
import { ok } from '../utils/api-response.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: env.jwtRefreshTtl * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

function getRefreshCookie(req: Request): string | null {
  const token = req.cookies?.[REFRESH_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function sendAuthResult(res: Response, status: number, result: AuthResult): void {
  setRefreshCookie(res, result.refreshToken);
  res.status(status).json({
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
}

export async function register(_req: Request, res: Response): Promise<void> {
  const body = res.locals.validatedBody as { email: string; password: string };
  const result = await authService.register(body, getAuditContext(res));
  sendAuthResult(res, 201, result);
}

export async function login(_req: Request, res: Response): Promise<void> {
  const body = res.locals.validatedBody as { email: string; password: string };
  const result = await authService.login(body, getAuditContext(res));
  sendAuthResult(res, 200, result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = getRefreshCookie(req);
  if (token === null) {
    throw new ApiError(401, 'Refresh token missing');
  }
  const result = await authService.refresh(token);
  sendAuthResult(res, 200, result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(getRefreshCookie(req) ?? undefined, getAuditContext(res));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (req.user === undefined) {
    throw new ApiError(401, 'Authentication required');
  }
  const user = await authService.getMe(req.user.id);
  ok(res, { user });
}
