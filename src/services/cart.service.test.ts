import { describe, expect, it } from 'vitest';
import { computeTotals, TAX_RATE } from './cart.service.js';

const item = (unitPrice: number, quantity: number) => ({ unitPrice, quantity });

describe('cart service: computeTotals', () => {
  it('applies a flat 8.25% tax rate', () => {
    expect(TAX_RATE).toBe(0.0825);
  });

  it('computes zero totals for an empty cart', () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it('computes subtotal, tax, and total for a single item', () => {
    expect(computeTotals([item(33.33, 1)])).toEqual({
      subtotal: 33.33,
      tax: 2.75,
      total: 36.08,
    });
  });

  it('rounds tax to two decimal places', () => {
    expect(computeTotals([item(19.99, 3)])).toEqual({
      subtotal: 59.97,
      tax: 4.95,
      total: 64.92,
    });
  });

  it('sums multiple items and multiplies by quantity', () => {
    expect(computeTotals([item(10, 2), item(5.5, 3)])).toEqual({
      subtotal: 36.5,
      tax: 3.01,
      total: 39.51,
    });
  });

  it('computes a clean 8.25% on a round subtotal', () => {
    expect(computeTotals([item(100, 1)])).toEqual({
      subtotal: 100,
      tax: 8.25,
      total: 108.25,
    });
  });
});
