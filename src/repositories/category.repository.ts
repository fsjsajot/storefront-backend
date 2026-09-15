import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { Category, Image } from '../models/index.js';

type CategoryRow = Prisma.CategoryGetPayload<true>;

function mapCategory(row: CategoryRow): Category {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image as unknown as Image,
  };
}

async function findCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return rows.map(mapCategory);
}

async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await prisma.category.findUnique({ where: { slug } });
  if (row === null) {
    return null;
  }
  return mapCategory(row);
}

export const categoryRepository = {
  findCategories,
  findCategoryBySlug,
};
