import type { Product } from '../models/index.js';
import { productRepository } from '../repositories/product.repository.js';

export const SEARCH_PAGE_SIZE = 6;

export const SEARCH_SORTS = ['relevance', 'price-asc', 'price-desc', 'newest', 'rating'] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: SearchSort;
  page: number;
  pageSize?: number;
}

export interface SearchFilters {
  q: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: SearchSort;
}

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: SearchFilters;
  hasActiveFilters: boolean;
}

function normalizeQuery(q: string | undefined): string {
  return (q ?? '').trim().toLowerCase();
}

function textMatches(product: Product, needle: string): boolean {
  if (needle === '') {
    return true;
  }
  return (
    product.name.toLowerCase().includes(needle) ||
    product.description.toLowerCase().includes(needle)
  );
}

function matchesFilters(product: Product, params: SearchParams, q: string): boolean {
  if (params.category !== undefined && product.categorySlug !== params.category) {
    return false;
  }
  if (params.minPrice !== undefined && product.price.amount < params.minPrice) {
    return false;
  }
  if (params.maxPrice !== undefined && product.price.amount > params.maxPrice) {
    return false;
  }
  if (q !== '' && !textMatches(product, q)) {
    return false;
  }
  return true;
}

function relevanceScore(product: Product, needle: string): number {
  const name = product.name.toLowerCase();
  const description = product.description.toLowerCase();
  if (name === needle) {
    return 4;
  }
  if (name.startsWith(needle)) {
    return 3;
  }
  if (name.includes(needle)) {
    return 2;
  }
  if (description.includes(needle)) {
    return 1;
  }
  return 0;
}

function byName(a: Product, b: Product): number {
  return a.name.localeCompare(b.name);
}

function comparator(sort: SearchSort, q: string): (a: Product, b: Product) => number {
  switch (sort) {
    case 'price-asc':
      return (a, b) =>
        a.price.amount !== b.price.amount ? a.price.amount - b.price.amount : byName(a, b);
    case 'price-desc':
      return (a, b) =>
        a.price.amount !== b.price.amount ? b.price.amount - a.price.amount : byName(a, b);
    case 'newest':
      return (a, b) =>
        a.createdAt !== b.createdAt ? b.createdAt.getTime() - a.createdAt.getTime() : byName(a, b);
    case 'rating':
      return (a, b) => (a.rating !== b.rating ? b.rating - a.rating : byName(a, b));
    case 'relevance':
    default: {
      if (q === '') {
        return byName;
      }
      return (a, b) => {
        const diff = relevanceScore(b, q) - relevanceScore(a, q);
        return diff !== 0 ? diff : byName(a, b);
      };
    }
  }
}

export function applySearch(products: Product[], params: SearchParams): SearchResult {
  const pageSize = params.pageSize ?? SEARCH_PAGE_SIZE;
  const q = normalizeQuery(params.q);
  const hasActiveFilters =
    q !== '' ||
    params.category !== undefined ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined;

  const filtered = products.filter((product) => matchesFilters(product, params, q));
  const sorted = [...filtered].sort(comparator(params.sort, q));
  const total = sorted.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (params.page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  return {
    items,
    total,
    page: params.page,
    pageSize,
    totalPages,
    filters: {
      q,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
    },
    hasActiveFilters,
  };
}

export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  const products = await productRepository.findAllProducts();
  return applySearch(products, params);
}

export const searchService = {
  searchProducts,
};
