import { z } from 'zod';

const idRegex = /^[a-zA-Z0-9_-]+$/;

export const CartIdParamsSchema = z.object({
  cartId: z.string().min(1).max(100).regex(idRegex),
});

export const CartItemParamsSchema = z.object({
  cartId: z.string().min(1).max(100).regex(idRegex),
  itemId: z.string().min(1).max(100).regex(idRegex),
});

export const AddCartItemBodySchema = z.object({
  productId: z.string().min(1).max(100),
  variantId: z.string().min(1).max(100).optional(),
  quantity: z.number().int().min(1),
});

export const UpdateCartItemBodySchema = z.object({
  quantity: z.number().int().min(1),
});
