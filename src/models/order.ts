import type { Address } from './address.js';
import type { CartItem } from './cart-item.js';

export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled';

export interface Order {
  id: string;
  cartId: string;
  items: CartItem[];
  shippingAddress: Address;
  contactEmail: string;
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  createdAt: Date;
}
