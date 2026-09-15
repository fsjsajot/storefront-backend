import { z } from 'zod';
import { CartItemSchema } from './cart-item.schema.js';

export const CartSchema = z.object({
  id: z.string().min(1),
  items: z.array(CartItemSchema),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CartSchema = z.infer<typeof CartSchema>;
