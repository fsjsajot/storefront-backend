import { z } from 'zod';
import { SEARCH_SORTS } from '../services/search.service.js';

export const SearchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(SEARCH_SORTS).default('relevance'),
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine(
    (data) =>
      data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
    {
      message: 'minPrice must be less than or equal to maxPrice',
      path: ['minPrice', 'maxPrice'],
    },
  );
