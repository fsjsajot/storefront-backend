import { z } from 'zod';
import { PriceSchema } from './price.schema.js';

export const ProductVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  price: PriceSchema.optional(),
  stock: z.number().int().nonnegative(),
});

export type ProductVariantSchema = z.infer<typeof ProductVariantSchema>;
