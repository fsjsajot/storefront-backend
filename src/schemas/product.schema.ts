import { z } from 'zod';
import { ImageSchema } from './image.schema.js';
import { PriceSchema } from './price.schema.js';
import { ProductVariantSchema } from './product-variant.schema.js';

export const ProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price: PriceSchema,
  images: z.array(ImageSchema),
  categorySlug: z.string().min(1),
  stock: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5),
  createdAt: z.coerce.date(),
  variants: z.array(ProductVariantSchema),
});

export type ProductSchema = z.infer<typeof ProductSchema>;
