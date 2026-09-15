import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { Address, CartItem, Order, OrderStatus } from '../models/index.js';
import {
  orderRepository,
  type OrderRow,
  type VariantRow,
} from '../repositories/order.repository.js';
import { ApiError } from '../utils/api-error.js';
import { computeTotals } from '../utils/money.js';

export interface CreateOrderInput {
  cartId: string;
  contactEmail: string;
  shippingAddress: Address;
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    cartId: row.cartId,
    items: row.items as unknown as CartItem[],
    shippingAddress: row.shippingAddress as unknown as Address,
    contactEmail: row.contactEmail,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return prisma
    .$transaction(async (tx) => {
      const cart = await orderRepository.findCartById(tx, input.cartId);
      if (cart === null) {
        throw new ApiError(404, 'Cart not found');
      }

      const cartItems = await orderRepository.findCartItems(tx, input.cartId);
      if (cartItems.length === 0) {
        throw new ApiError(400, 'Cannot create an order from an empty cart');
      }

      const items: CartItem[] = [];
      const stockActions: Promise<void>[] = [];

      for (const cartItem of cartItems) {
        const product = await orderRepository.findProductById(tx, cartItem.productId);
        if (product === null) {
          throw new ApiError(
            409,
            'Insufficient stock: a product in the cart is no longer available',
          );
        }

        let variant: VariantRow | null = null;
        if (cartItem.variantId !== null) {
          const found = await orderRepository.findVariantById(tx, cartItem.variantId);
          if (found === null) {
            throw new ApiError(
              409,
              'Insufficient stock: a variant in the cart is no longer available',
            );
          }
          variant = found;
        }

        const availableStock = variant !== null ? variant.stock : product.stock;
        if (availableStock < cartItem.quantity) {
          const name = variant !== null ? variant.name : product.name;
          throw new ApiError(
            409,
            `Insufficient stock for ${name}: requested ${cartItem.quantity}, available ${availableStock}`,
          );
        }

        if (variant !== null) {
          stockActions.push(
            orderRepository.decrementVariantStock(tx, variant.id, cartItem.quantity),
          );
        } else {
          stockActions.push(
            orderRepository.decrementProductStock(tx, product.id, cartItem.quantity),
          );
        }

        items.push({
          productId: cartItem.productId,
          variantId: cartItem.variantId ?? undefined,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          currency: cartItem.currency,
        });
      }

      await Promise.all(stockActions);

      const totals = computeTotals(items);
      const order = await orderRepository.createOrder(tx, {
        cartId: input.cartId,
        contactEmail: input.contactEmail,
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        items: items as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
      });

      return mapOrder(order);
    })
    .catch((err: unknown) => {
      if (isUniqueConstraintError(err)) {
        throw new ApiError(409, 'An order already exists for this cart');
      }
      throw err;
    });
}

export async function getOrder(orderId: string): Promise<Order> {
  const row = await orderRepository.findOrderById(orderId);
  if (row === null) {
    throw new ApiError(404, 'Order not found');
  }
  return mapOrder(row);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const row = await orderRepository.findOrderById(orderId);
  if (row === null) {
    throw new ApiError(404, 'Order not found');
  }
  if (!canTransition(row.status, status)) {
    throw new ApiError(400, `Invalid status transition: ${row.status} -> ${status}`);
  }
  const updated = await orderRepository.updateOrderStatus(orderId, status);
  return mapOrder(updated);
}

export const orderService = {
  createOrder,
  getOrder,
  updateOrderStatus,
  canTransition,
};
