import type { Request, Response } from 'express';
import type { Address, OrderStatus } from '../models/index.js';
import { orderService } from '../services/order.service.js';
import { ok } from '../utils/api-response.js';

export async function createOrder(_req: Request, res: Response): Promise<void> {
  const body = res.locals.validatedBody as {
    cartId: string;
    contactEmail: string;
    shippingAddress: Address;
  };
  const order = await orderService.createOrder(body);
  res.status(201).json({ data: order });
}

export async function getOrder(_req: Request, res: Response): Promise<void> {
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const order = await orderService.getOrder(orderId);
  ok(res, order);
}

export async function updateOrderStatus(_req: Request, res: Response): Promise<void> {
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const { status } = res.locals.validatedBody as { status: OrderStatus };
  const order = await orderService.updateOrderStatus(orderId, status);
  ok(res, order);
}
