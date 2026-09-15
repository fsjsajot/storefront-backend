import type { Price } from './price.js';

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: Price;
  stock: number;
}
