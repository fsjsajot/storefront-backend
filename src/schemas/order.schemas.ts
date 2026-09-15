import { z } from 'zod';
import { AddressSchema } from './address.schema.js';
import { OrderStatusSchema } from './order.schema.js';

const idRegex = /^[a-zA-Z0-9_-]+$/;

export const OrderIdParamsSchema = z.object({
  orderId: z.string().min(1).max(100).regex(idRegex),
});

export const CreateOrderBodySchema = z.object({
  cartId: z.string().min(1).max(100),
  contactEmail: z.string().email(),
  shippingAddress: AddressSchema,
});

export const UpdateOrderStatusBodySchema = z.object({
  status: OrderStatusSchema,
});
