import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type AuditLogRow = Prisma.AuditLogGetPayload<true>;

export type AuditActorType = 'USER' | 'GUEST' | 'SYSTEM';

export interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actorType: AuditActorType;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogRow> {
  return prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: input.actorType,
      actorId: input.actorId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

async function findAuditLogs(filter: AuditLogFilter): Promise<AuditLogRow[]> {
  return prisma.auditLog.findMany({
    where: {
      ...(filter.entityType !== undefined ? { entityType: filter.entityType } : {}),
      ...(filter.entityId !== undefined ? { entityId: filter.entityId } : {}),
      ...(filter.from !== undefined || filter.to !== undefined
        ? {
            createdAt: {
              ...(filter.from !== undefined ? { gte: filter.from } : {}),
              ...(filter.to !== undefined ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export const auditRepository = {
  createAuditLog,
  findAuditLogs,
};
