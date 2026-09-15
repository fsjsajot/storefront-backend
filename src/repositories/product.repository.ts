import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { Image, Product, ProductVariant } from '../models/index.js';

type ProductRow = Prisma.ProductGetPayload<{ include: { variants: true } }>;

function mapVariant(row: ProductRow['variants'][number]): ProductVariant {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    price:
      row.priceAmount !== null && row.priceCurrency !== null
        ? { amount: row.priceAmount, currency: row.priceCurrency }
        : undefined,
    stock: row.stock,
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: { amount: row.priceAmount, currency: row.priceCurrency },
    images: row.images as unknown as Image[],
    categorySlug: row.categorySlug,
    stock: row.stock,
    rating: row.rating,
    createdAt: row.createdAt,
    variants: row.variants.map(mapVariant),
  };
}

async function findProductsPaginated(
  page: number,
  pageSize: number,
): Promise<{ items: Product[]; total: number }> {
  const skip = (page - 1) * pageSize;
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      skip,
      take: pageSize,
      include: { variants: true },
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    }),
    prisma.product.count(),
  ]);
  return { items: rows.map(mapProduct), total };
}

async function findProductBySlug(slug: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true },
  });
  if (row === null) {
    return null;
  }
  return mapProduct(row);
}

async function findProductsByCategorySlug(slug: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { categorySlug: slug },
    include: { variants: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(mapProduct);
}

async function findAllProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(mapProduct);
}

export const productRepository = {
  findProductsPaginated,
  findProductBySlug,
  findProductsByCategorySlug,
  findAllProducts,
};
