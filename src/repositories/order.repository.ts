import { Prisma, type OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type Tx = Prisma.TransactionClient;
export type OrderRow = Prisma.OrderGetPayload<true>;
export type CartItemRow = Prisma.CartItemGetPayload<true>;
export type ProductRow = Prisma.ProductGetPayload<true>;
export type VariantRow = Prisma.ProductVariantGetPayload<true>;

export interface CreateOrderInput {
  cartId: string;
  contactEmail: string;
  shippingAddress: Prisma.InputJsonValue;
  items: Prisma.InputJsonValue;
  subtotal: number;
  tax: number;
  total: number;
}

async function findCartById(tx: Tx, cartId: string): Promise<{ id: string } | null> {
  return tx.cart.findUnique({ where: { id: cartId } });
}

async function findCartItems(tx: Tx, cartId: string): Promise<CartItemRow[]> {
  return tx.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: 'asc' } });
}

async function findProductById(tx: Tx, productId: string): Promise<ProductRow | null> {
  return tx.product.findUnique({ where: { id: productId } });
}

async function findVariantById(tx: Tx, variantId: string): Promise<VariantRow | null> {
  return tx.productVariant.findUnique({ where: { id: variantId } });
}

async function decrementProductStock(tx: Tx, productId: string, quantity: number): Promise<void> {
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } },
  });
}

async function decrementVariantStock(tx: Tx, variantId: string, quantity: number): Promise<void> {
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: { decrement: quantity } },
  });
}

async function createOrder(tx: Tx, input: CreateOrderInput): Promise<OrderRow> {
  return tx.order.create({
    data: {
      cartId: input.cartId,
      contactEmail: input.contactEmail,
      shippingAddress: input.shippingAddress,
      items: input.items,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      status: 'pending',
    },
  });
}

async function findOrderById(orderId: string): Promise<OrderRow | null> {
  return prisma.order.findUnique({ where: { id: orderId } });
}

async function updateOrderStatus(orderId: string, status: PrismaOrderStatus): Promise<OrderRow> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}

export const orderRepository = {
  findCartById,
  findCartItems,
  findProductById,
  findVariantById,
  decrementProductStock,
  decrementVariantStock,
  createOrder,
  findOrderById,
  updateOrderStatus,
};
