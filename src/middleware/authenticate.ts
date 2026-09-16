import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ApiError } from '../utils/api-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export type AuthUserRole = 'CUSTOMER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: AuthUserRole;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || typeof token !== 'string' || token.length === 0) {
    return null;
  }
  return token;
}

export function authenticate(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = getBearerToken(req);
    if (token === null) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      next();
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        next(new ApiError(401, 'Access token expired'));
        return;
      }
      if (err instanceof JsonWebTokenError) {
        next(new ApiError(401, 'Invalid access token'));
        return;
      }
      next(err);
    }
  };
}
