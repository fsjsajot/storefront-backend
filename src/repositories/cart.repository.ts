import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type CartWithItems = Prisma.CartGetPayload<{ include: { items: true } }>;
export type ProductRow = Prisma.ProductGetPayload<true>;
export type VariantRow = Prisma.ProductVariantGetPayload<true>;
export type CartItemRow = Prisma.CartItemGetPayload<true>;

export interface CartItemTotals {
  subtotal: number;
  tax: number;
  total: number;
}

async function createCart(): Promise<CartWithItems> {
  const cart = await prisma.cart.create({
    data: { subtotal: 0, tax: 0, total: 0 },
  });
  return { ...cart, items: [] };
}

async function findCartById(cartId: string): Promise<CartWithItems | null> {
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (cart === null) {
    return null;
  }
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: 'asc' },
  });
  return { ...cart, items };
}

async function findProductById(productId: string): Promise<ProductRow | null> {
  return prisma.product.findUnique({ where: { id: productId } });
}

async function findVariantById(variantId: string): Promise<VariantRow | null> {
  return prisma.productVariant.findUnique({ where: { id: variantId } });
}

async function findCartItemByProductAndVariant(
  cartId: string,
  productId: string,
  variantId: string | null,
): Promise<CartItemRow | null> {
  return prisma.cartItem.findFirst({ where: { cartId, productId, variantId } });
}

async function findCartItemById(cartId: string, itemId: string): Promise<CartItemRow | null> {
  return prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
}

async function createCartItem(data: {
  cartId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
}): Promise<void> {
  await prisma.cartItem.create({ data });
}

async function updateCartItemQuantity(itemId: string, quantity: number): Promise<void> {
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

async function updateCartTotals(cartId: string, totals: CartItemTotals): Promise<void> {
  await prisma.cart.update({
    where: { id: cartId },
    data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
  });
}

async function deleteCartItem(itemId: string): Promise<void> {
  await prisma.cartItem.delete({ where: { id: itemId } });
}

async function deleteCartItems(cartId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

export const cartRepository = {
  createCart,
  findCartById,
  findProductById,
  findVariantById,
  findCartItemByProductAndVariant,
  findCartItemById,
  createCartItem,
  updateCartItemQuantity,
  updateCartTotals,
  deleteCartItem,
  deleteCartItems,
};
