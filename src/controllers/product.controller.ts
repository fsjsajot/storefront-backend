import type { Request, Response } from 'express';
import { productService } from '../services/product.service.js';
import { ApiError } from '../utils/api-error.js';
import { ok } from '../utils/api-response.js';

export async function listProducts(_req: Request, res: Response): Promise<void> {
  const { page, pageSize } = res.locals.validatedQuery as { page: number; pageSize: number };
  const result = await productService.listProducts(page, pageSize);
  ok(res, result.items, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function getProductBySlug(_req: Request, res: Response): Promise<void> {
  const { slug } = res.locals.validatedParams as { slug: string };
  const product = await productService.getProductBySlug(slug);
  if (product === null) {
    throw new ApiError(404, 'Product not found');
  }
  ok(res, product);
}
