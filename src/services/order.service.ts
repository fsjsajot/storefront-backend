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
import { recordAudit, type AuditActorType, type AuditContext } from './audit.service.js';

export interface CreateOrderInput {
  cartId: string;
  userId?: string | null;
  contactEmail: string;
  shippingAddress: Address;
}

export interface OrderViewer {
  id: string;
  role: 'CUSTOMER' | 'ADMIN';
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

function actorForOrder(
  cartId: string,
  context?: AuditContext,
): { actorType: AuditActorType; actorId: string | null } {
  if (context?.actorType === 'USER') {
    return { actorType: 'USER', actorId: context.actorId ?? null };
  }
  return { actorType: 'GUEST', actorId: cartId };
}

export async function createOrder(input: CreateOrderInput, context?: AuditContext): Promise<Order> {
  const order = await prisma
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
        userId: input.userId ?? null,
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

  const actor = actorForOrder(input.cartId, context);
  await recordAudit({
    entityType: 'Order',
    entityId: order.id,
    action: 'ORDER_CREATED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    metadata: { cartId: input.cartId, total: order.total },
    context,
  });
  return order;
}

export async function getOrder(orderId: string, viewer?: OrderViewer): Promise<Order> {
  const row = await orderRepository.findOrderById(orderId);
  if (row === null) {
    throw new ApiError(404, 'Order not found');
  }
  if (viewer !== undefined && row.userId !== viewer.id && viewer.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have access to this order');
  }
  return mapOrder(row);
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const rows = await orderRepository.findOrdersByUserId(userId);
  return rows.map(mapOrder);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  context?: AuditContext,
): Promise<Order> {
  const row = await orderRepository.findOrderById(orderId);
  if (row === null) {
    throw new ApiError(404, 'Order not found');
  }
  if (!canTransition(row.status, status)) {
    throw new ApiError(400, `Invalid status transition: ${row.status} -> ${status}`);
  }
  const updated = await orderRepository.updateOrderStatus(orderId, status);
  await recordAudit({
    entityType: 'Order',
    entityId: orderId,
    action: 'ORDER_STATUS_CHANGED',
    actorType: context?.actorType,
    actorId: context?.actorId,
    metadata: { from: row.status, to: status },
    context,
  });
  return mapOrder(updated);
}

export const orderService = {
  createOrder,
  getOrder,
  listOrdersForUser,
  updateOrderStatus,
  canTransition,
};
