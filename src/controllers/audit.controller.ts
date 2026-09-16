import type { Request, Response } from 'express';
import { auditService } from '../services/audit.service.js';
import { orderService } from '../services/order.service.js';
import { ok } from '../utils/api-response.js';

export async function listAuditLogs(_req: Request, res: Response): Promise<void> {
  const query = res.locals.validatedQuery as {
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
  };
  const rows = await auditService.listAuditLogs(query);
  ok(res, rows);
}

export async function getOrderAuditLog(req: Request, res: Response): Promise<void> {
  const { orderId } = res.locals.validatedParams as { orderId: string };
  await orderService.getOrder(orderId, req.user);
  const rows = await auditService.listAuditLogs({ entityType: 'Order', entityId: orderId });
  ok(res, rows);
}
