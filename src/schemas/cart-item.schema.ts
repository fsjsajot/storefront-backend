import { z } from 'zod';

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
});

export type CartItemSchema = z.infer<typeof CartItemSchema>;
