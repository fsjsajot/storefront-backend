import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { logger } from '../config/logger.js';
import type { AuthUser } from '../middleware/authenticate.js';
import {
  auditRepository,
  type AuditActorType,
  type AuditLogRow,
} from '../repositories/audit.repository.js';

export type { AuditActorType, AuditLogRow };

export interface AuditContext {
  actorType: AuditActorType;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface RecordAuditInput {
  entityType: string;
  entityId: string;
  action: string;
  actorType?: AuditActorType;
  actorId?: string | null;
  metadata?: unknown;
  context?: AuditContext | null;
}

export interface AuditLogQuery {
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

export function captureAuditContext(req: Request): AuditContext {
  const user = (req as { user?: AuthUser }).user;
  const requestId = (req as { id?: unknown }).id;
  return {
    actorType: user !== undefined ? 'USER' : 'GUEST',
    actorId: user?.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await auditRepository.createAuditLog({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: input.actorType ?? input.context?.actorType ?? 'SYSTEM',
      actorId: input.actorId ?? input.context?.actorId ?? null,
      ipAddress: input.context?.ipAddress ?? null,
      userAgent: input.context?.userAgent ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null,
    });
  } catch (err) {
    logger.error(
      {
        err,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        requestId: input.context?.requestId ?? null,
      },
      'Failed to write audit log',
    );
  }
}

export async function listAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogRow[]> {
  return auditRepository.findAuditLogs(query);
}

export const auditService = {
  captureAuditContext,
  recordAudit,
  listAuditLogs,
};
