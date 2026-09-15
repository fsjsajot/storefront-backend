import type { Category, Product } from '../models/index.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { productRepository } from '../repositories/product.repository.js';

async function listCategories(): Promise<Category[]> {
  return categoryRepository.findCategories();
}

async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return categoryRepository.findCategoryBySlug(slug);
}

async function getProductsByCategorySlug(slug: string): Promise<Product[] | null> {
  const category = await categoryRepository.findCategoryBySlug(slug);
  if (category === null) {
    return null;
  }
  return productRepository.findProductsByCategorySlug(slug);
}

export const categoryService = {
  listCategories,
  getCategoryBySlug,
  getProductsByCategorySlug,
};
