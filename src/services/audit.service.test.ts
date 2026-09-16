import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../config/logger.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { captureAuditContext, recordAudit } from './audit.service.js';

vi.mock('../repositories/audit.repository.js', () => ({
  auditRepository: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

type AuditLogRow = Awaited<ReturnType<typeof auditRepository.createAuditLog>>;

const context = {
  actorType: 'USER',
  actorId: 'user-1',
  ipAddress: '203.0.113.7',
  userAgent: 'audit-test-agent',
  requestId: 'req-123',
} as const;

describe('audit service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditRepository.createAuditLog).mockResolvedValue({} as AuditLogRow);
  });

  describe('recordAudit', () => {
    it('writes an audit entry with the supplied context', async () => {
      await recordAudit({
        entityType: 'Order',
        entityId: 'order-1',
        action: 'create',
        metadata: { before: null, after: { status: 'pending' } },
        context,
      });

      expect(auditRepository.createAuditLog).toHaveBeenCalledWith({
        entityType: 'Order',
        entityId: 'order-1',
        action: 'create',
        actorType: 'USER',
        actorId: 'user-1',
        ipAddress: '203.0.113.7',
        userAgent: 'audit-test-agent',
        metadata: { before: null, after: { status: 'pending' } },
      });
    });

    it('defaults to SYSTEM actor when no context is provided', async () => {
      await recordAudit({ entityType: 'System', entityId: 'job-1', action: 'run' });

      expect(auditRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'System',
          entityId: 'job-1',
          action: 'run',
          actorType: 'SYSTEM',
          actorId: null,
          metadata: null,
        }),
      );
    });

    it('does not throw when the audit write fails and logs the error', async () => {
      const writeError = new Error('database unavailable');
      vi.mocked(auditRepository.createAuditLog).mockRejectedValue(writeError);

      await expect(
        recordAudit({ entityType: 'Order', entityId: 'order-1', action: 'update', context }),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: writeError, entityType: 'Order', requestId: 'req-123' }),
        'Failed to write audit log',
      );
    });

    it('does not block the caller on malformed metadata', async () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      vi.mocked(auditRepository.createAuditLog).mockRejectedValue(
        new Error('JSON serialization failed'),
      );

      await expect(
        recordAudit({
          entityType: 'Cart',
          entityId: 'cart-1',
          action: 'clear',
          metadata: circular,
        }),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('captureAuditContext', () => {
    it('captures an authenticated user as the actor', () => {
      const req = {
        user: { id: 'user-1', email: 'a@example.com', role: 'ADMIN' },
        ip: '203.0.113.7',
        headers: { 'user-agent': 'audit-test-agent' },
        id: 'req-123',
      } as unknown as Request;

      expect(captureAuditContext(req)).toEqual({
        actorType: 'USER',
        actorId: 'user-1',
        ipAddress: '203.0.113.7',
        userAgent: 'audit-test-agent',
        requestId: 'req-123',
      });
    });

    it('captures a guest actor for unauthenticated requests', () => {
      const req = { ip: '203.0.113.8', headers: {} } as unknown as Request;

      expect(captureAuditContext(req)).toEqual({
        actorType: 'GUEST',
        actorId: undefined,
        ipAddress: '203.0.113.8',
        userAgent: null,
        requestId: null,
      });
    });
  });
});
