import type { Request, Response } from 'express';
import { searchService, type SearchSort } from '../services/search.service.js';

export async function searchProducts(_req: Request, res: Response): Promise<void> {
  const query = res.locals.validatedQuery as {
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sort: SearchSort;
    page: number;
  };
  const result = await searchService.searchProducts({
    q: query.q,
    category: query.category,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    page: query.page,
  });
  res.status(200).json(result);
}
