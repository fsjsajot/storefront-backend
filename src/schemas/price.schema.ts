import { z } from 'zod';

export const PriceSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
});

export type PriceSchema = z.infer<typeof PriceSchema>;
