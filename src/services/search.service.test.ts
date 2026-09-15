import { describe, expect, it } from 'vitest';
import type { Product } from '../models/index.js';
import { applySearch, SEARCH_PAGE_SIZE, type SearchParams } from './search.service.js';

function d(day: number): Date {
  return new Date(`2024-01-0${day}T00:00:00Z`);
}

function makeProduct(p: {
  slug: string;
  name: string;
  description: string;
  priceAmount: number;
  categorySlug: string;
  rating: number;
  createdAt: Date;
}): Product {
  return {
    id: p.slug,
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: { amount: p.priceAmount, currency: 'USD' },
    images: [],
    categorySlug: p.categorySlug,
    stock: 10,
    rating: p.rating,
    createdAt: p.createdAt,
    variants: [],
  };
}

const products = [
  makeProduct({
    slug: 'studio-pro',
    name: 'Studio Pro Headphones',
    description: 'Wired reference headphones for pros',
    priceAmount: 249,
    categorySlug: 'audio',
    rating: 4.8,
    createdAt: d(1),
  }),
  makeProduct({
    slug: 'echo-earbuds',
    name: 'Echo Earbuds',
    description: 'Pro-grade sound in compact buds',
    priceAmount: 129,
    categorySlug: 'audio',
    rating: 4.2,
    createdAt: d(2),
  }),
  makeProduct({
    slug: 'bass-speaker',
    name: 'Bass Speaker',
    description: 'Portable speaker with deep bass',
    priceAmount: 89,
    categorySlug: 'audio',
    rating: 4.5,
    createdAt: d(3),
  }),
  makeProduct({
    slug: 'pulse-watch',
    name: 'Pulse Watch',
    description: 'Fitness watch with GPS',
    priceAmount: 149,
    categorySlug: 'wearables',
    rating: 4.6,
    createdAt: d(4),
  }),
  makeProduct({
    slug: 'shell-case',
    name: 'Shell Case',
    description: 'Protective phone case',
    priceAmount: 25,
    categorySlug: 'accessories',
    rating: 4.3,
    createdAt: d(5),
  }),
  makeProduct({
    slug: 'pro-mic',
    name: 'Pro Recording Mic',
    description: 'Studio condenser microphone',
    priceAmount: 199,
    categorySlug: 'audio',
    rating: 4.7,
    createdAt: d(6),
  }),
];

const relevanceProducts = [
  makeProduct({
    slug: 'watch-band',
    name: 'Watch Band',
    description: 'Silicone band for any device',
    priceAmount: 12,
    categorySlug: 'accessories',
    rating: 4.0,
    createdAt: d(1),
  }),
  makeProduct({
    slug: 'time-watch',
    name: 'Time Watch',
    description: 'Analog fitness watch',
    priceAmount: 120,
    categorySlug: 'wearables',
    rating: 4.4,
    createdAt: d(2),
  }),
  makeProduct({
    slug: 'stride-tracker',
    name: 'Stride Tracker',
    description: 'Tracks steps like a watch',
    priceAmount: 60,
    categorySlug: 'wearables',
    rating: 4.1,
    createdAt: d(3),
  }),
];

function search(overrides: Partial<SearchParams> = {}): ReturnType<typeof applySearch> {
  return applySearch(products, {
    q: overrides.q ?? '',
    sort: overrides.sort ?? 'relevance',
    page: overrides.page ?? 1,
    category: overrides.category,
    minPrice: overrides.minPrice,
    maxPrice: overrides.maxPrice,
    pageSize: overrides.pageSize,
  });
}

const slugs = (result: ReturnType<typeof applySearch>): string[] => result.items.map((p) => p.slug);

describe('search service: filtering', () => {
  it('returns all products for an empty query', () => {
    const result = search({ q: '' });
    expect(result.total).toBe(products.length);
    expect(result.hasActiveFilters).toBe(false);
    expect(result.items).toHaveLength(products.length);
  });

  it('matches text against name or description case-insensitively', () => {
    const byName = search({ q: 'EARBUDS' });
    expect(slugs(byName)).toEqual(['echo-earbuds']);

    const byDescription = search({ q: 'deep bass' });
    expect(slugs(byDescription)).toEqual(['bass-speaker']);
  });

  it('filters by category slug', () => {
    const result = search({ category: 'wearables' });
    expect(slugs(result)).toEqual(['pulse-watch']);
    expect(result.total).toBe(1);
  });

  it('filters by minimum price', () => {
    const result = search({ minPrice: 140 });
    expect(slugs(result)).toEqual(['pro-mic', 'pulse-watch', 'studio-pro']);
  });

  it('filters by maximum price', () => {
    const result = search({ maxPrice: 100 });
    expect(slugs(result)).toEqual(['bass-speaker', 'shell-case']);
  });

  it('combines text, category, and price filters', () => {
    const result = search({ q: 'pro', category: 'audio', minPrice: 150 });
    expect(slugs(result)).toEqual(['pro-mic', 'studio-pro']);
  });

  it('returns no results for a query with no matches', () => {
    const result = search({ q: 'zzzz-not-here' });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.hasActiveFilters).toBe(true);
  });

  it('returns no results when no product is in the price range', () => {
    const result = search({ minPrice: 500, maxPrice: 1000 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('trims the query and reports active filters', () => {
    const result = search({ q: '  earbuds  ' });
    expect(result.filters.q).toBe('earbuds');
    expect(result.hasActiveFilters).toBe(true);
    expect(slugs(result)).toEqual(['echo-earbuds']);
  });

  it('reports hasActiveFilters for category and price filters', () => {
    expect(search({ category: 'audio' }).hasActiveFilters).toBe(true);
    expect(search({ minPrice: 10 }).hasActiveFilters).toBe(true);
    expect(search({ maxPrice: 10 }).hasActiveFilters).toBe(true);
    expect(search({}).hasActiveFilters).toBe(false);
  });

  it('echoes the applied filters in the result', () => {
    const result = search({
      q: 'watch',
      category: 'wearables',
      minPrice: 50,
      maxPrice: 150,
      sort: 'price-asc',
    });
    expect(result.filters).toEqual({
      q: 'watch',
      category: 'wearables',
      minPrice: 50,
      maxPrice: 150,
      sort: 'price-asc',
    });
  });
});

describe('search service: sorting', () => {
  it('sorts by relevance: name prefix, name match, then description match', () => {
    const result = applySearch(relevanceProducts, {
      q: 'watch',
      sort: 'relevance',
      page: 1,
    });
    expect(slugs(result)).toEqual(['watch-band', 'time-watch', 'stride-tracker']);
  });

  it('falls back to name order for relevance without a query', () => {
    const result = search({ sort: 'relevance' });
    expect(slugs(result)).toEqual([
      'bass-speaker',
      'echo-earbuds',
      'pro-mic',
      'pulse-watch',
      'shell-case',
      'studio-pro',
    ]);
  });

  it('sorts by price ascending', () => {
    const result = search({ sort: 'price-asc' });
    expect(slugs(result)).toEqual([
      'shell-case',
      'bass-speaker',
      'echo-earbuds',
      'pulse-watch',
      'pro-mic',
      'studio-pro',
    ]);
  });

  it('sorts by price descending', () => {
    const result = search({ sort: 'price-desc' });
    expect(slugs(result)).toEqual([
      'studio-pro',
      'pro-mic',
      'pulse-watch',
      'echo-earbuds',
      'bass-speaker',
      'shell-case',
    ]);
  });

  it('sorts by newest first', () => {
    const result = search({ sort: 'newest' });
    expect(slugs(result)).toEqual([
      'pro-mic',
      'shell-case',
      'pulse-watch',
      'bass-speaker',
      'echo-earbuds',
      'studio-pro',
    ]);
  });

  it('sorts by rating descending', () => {
    const result = search({ sort: 'rating' });
    expect(slugs(result)).toEqual([
      'studio-pro',
      'pro-mic',
      'pulse-watch',
      'bass-speaker',
      'shell-case',
      'echo-earbuds',
    ]);
  });
});

describe('search service: pagination', () => {
  it('uses a fixed default page size of 6', () => {
    expect(SEARCH_PAGE_SIZE).toBe(6);
    const result = search({});
    expect(result.pageSize).toBe(6);
    expect(result.totalPages).toBe(1);
  });

  it('paginates results', () => {
    const pageOne = search({ sort: 'relevance', page: 1, pageSize: 2 });
    expect(pageOne.items).toHaveLength(2);
    expect(pageOne.total).toBe(6);
    expect(pageOne.totalPages).toBe(3);
    expect(slugs(pageOne)).toEqual(['bass-speaker', 'echo-earbuds']);

    const pageTwo = search({ sort: 'relevance', page: 2, pageSize: 2 });
    expect(slugs(pageTwo)).toEqual(['pro-mic', 'pulse-watch']);
  });

  it('returns empty items for a page beyond the last page', () => {
    const result = search({ sort: 'relevance', page: 10, pageSize: 2 });
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(3);
  });
});
