import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';

function requestId(req: Request): string | undefined {
  return typeof req.id === 'string' ? req.id : req.id !== undefined ? String(req.id) : undefined;
}

function sendError(res: Response, statusCode: number, message: string, details?: unknown): void {
  const body: { error: { message: string; requestId?: string; details?: unknown } } = {
    error: { message },
  };
  const id = requestId(res.req);
  if (id !== undefined) {
    body.error.requestId = id;
  }
  if (details !== undefined) {
    body.error.details = details;
  }
  res.status(statusCode).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 404, 'Route not found');
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, err.details);
    return;
  }
  if (err instanceof ZodError) {
    sendError(res, 400, 'Invalid input', err.issues);
    return;
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode?: unknown }).statusCode === 'number'
  ) {
    const statusCode = (err as { statusCode: number }).statusCode;
    if (statusCode >= 400 && statusCode < 500) {
      sendError(res, statusCode, 'Bad request');
      return;
    }
  }
  req.log.error({ err, requestId: requestId(req) }, 'Unhandled error');
  sendError(res, 500, 'Internal server error');
}
