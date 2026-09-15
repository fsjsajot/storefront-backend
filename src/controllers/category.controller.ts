import type { Request, Response } from 'express';
import { categoryService } from '../services/category.service.js';
import { ApiError } from '../utils/api-error.js';
import { ok } from '../utils/api-response.js';

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await categoryService.listCategories();
  ok(res, categories, { total: categories.length });
}

export async function getCategoryBySlug(_req: Request, res: Response): Promise<void> {
  const { slug } = res.locals.validatedParams as { slug: string };
  const category = await categoryService.getCategoryBySlug(slug);
  if (category === null) {
    throw new ApiError(404, 'Category not found');
  }
  ok(res, category);
}

export async function getProductsByCategorySlug(_req: Request, res: Response): Promise<void> {
  const { slug } = res.locals.validatedParams as { slug: string };
  const products = await categoryService.getProductsByCategorySlug(slug);
  if (products === null) {
    throw new ApiError(404, 'Category not found');
  }
  ok(res, products, { total: products.length });
}
