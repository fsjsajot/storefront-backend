import { z } from 'zod';
import { AddressSchema } from './address.schema.js';
import { CartItemSchema } from './cart-item.schema.js';

export const OrderStatusSchema = z.enum(['pending', 'paid', 'fulfilled', 'cancelled']);

export const OrderSchema = z.object({
  id: z.string().min(1),
  cartId: z.string().min(1),
  items: z.array(CartItemSchema),
  shippingAddress: AddressSchema,
  contactEmail: z.string().email(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  status: OrderStatusSchema,
  createdAt: z.coerce.date(),
});

export type OrderSchema = z.infer<typeof OrderSchema>;
