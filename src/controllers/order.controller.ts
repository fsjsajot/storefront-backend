import type { Request, Response } from 'express';
import { getAuditContext } from '../middleware/audit.js';
import type { Address, OrderStatus } from '../models/index.js';
import { orderService } from '../services/order.service.js';
import { ApiError } from '../utils/api-error.js';
import { ok } from '../utils/api-response.js';

export async function listOrders(req: Request, res: Response): Promise<void> {
  if (req.user === undefined) {
    throw new ApiError(401, 'Authentication required');
  }
  const orders = await orderService.listOrdersForUser(req.user.id);
  ok(res, orders);
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const body = res.locals.validatedBody as {
    cartId: string;
    contactEmail: string;
    shippingAddress: Address;
  };
  const order = await orderService.createOrder(
    {
      ...body,
      userId: req.user?.id,
    },
    getAuditContext(res),
  );
  res.status(201).json({ data: order });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const order = await orderService.getOrder(orderId, req.user);
  ok(res, order);
}

export async function updateOrderStatus(_req: Request, res: Response): Promise<void> {
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const { status } = res.locals.validatedBody as { status: OrderStatus };
  const order = await orderService.updateOrderStatus(orderId, status, getAuditContext(res));
  ok(res, order);
}
