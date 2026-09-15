import { z } from 'zod';
import { ImageSchema } from './image.schema.js';

export const CategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  image: ImageSchema,
});

export type CategorySchema = z.infer<typeof CategorySchema>;
