import type { Image } from './image.js';
import type { Price } from './price.js';
import type { ProductVariant } from './product-variant.js';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: Price;
  images: Image[];
  categorySlug: string;
  stock: number;
  rating: number;
  createdAt: Date;
  variants: ProductVariant[];
}
