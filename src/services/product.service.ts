import type { Product } from '../models/index.js';
import { productRepository } from '../repositories/product.repository.js';

export interface ProductListResult {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function listProducts(page: number, pageSize: number): Promise<ProductListResult> {
  const { items, total } = await productRepository.findProductsPaginated(page, pageSize);
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getProductBySlug(slug: string): Promise<Product | null> {
  return productRepository.findProductBySlug(slug);
}

export const productService = {
  listProducts,
  getProductBySlug,
};
