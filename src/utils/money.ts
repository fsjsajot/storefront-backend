import type { CartItem } from '../models/index.js';

export const TAX_RATE = 0.0825;

export interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeTotals(items: Pick<CartItem, 'quantity' | 'unitPrice'>[]): CartTotals {
  const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + tax);
  return { subtotal, tax, total };
}
