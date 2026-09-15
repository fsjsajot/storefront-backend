import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/api-error.js';

export function validateParams(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ApiError(400, 'Invalid path parameters', result.error.issues));
      return;
    }
    res.locals.validatedParams = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ApiError(400, 'Invalid query parameters', result.error.issues));
      return;
    }
    res.locals.validatedQuery = result.data;
    next();
  };
}

export function validateBody(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(400, 'Invalid request body', result.error.issues));
      return;
    }
    res.locals.validatedBody = result.data;
    next();
  };
}
