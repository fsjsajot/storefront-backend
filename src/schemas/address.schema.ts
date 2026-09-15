import { z } from 'zod';

export const AddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(2).max(2),
});

export type AddressSchema = z.infer<typeof AddressSchema>;
