import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../utils/api-error.js';
import type { AuthUserRole } from './authenticate.js';

export function authorize(...roles: AuthUserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (user === undefined) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(user.role)) {
      next(new ApiError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
