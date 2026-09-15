import { z } from 'zod';

export const ImageSchema = z.object({
  src: z.string().url(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type ImageSchema = z.infer<typeof ImageSchema>;
