import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { captureAuditContext, type AuditContext } from '../services/audit.service.js';

export function audit(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Object.defineProperty(res.locals, 'auditContext', {
      enumerable: true,
      configurable: true,
      get: () => captureAuditContext(req),
    });
    next();
  };
}

export function getAuditContext(res: Response): AuditContext | undefined {
  return res.locals.auditContext as AuditContext | undefined;
}

export { captureAuditContext };
export type { AuditContext };
