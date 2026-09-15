import type { Request, Response } from 'express';
import { cartService } from '../services/cart.service.js';
import { ok } from '../utils/api-response.js';

export async function createCart(_req: Request, res: Response): Promise<void> {
  const cart = await cartService.createCart();
  ok(res, cart);
}

export async function getCart(_req: Request, res: Response): Promise<void> {
  const { cartId } = res.locals.validatedParams as { cartId: string };
  const cart = await cartService.getCart(cartId);
  ok(res, cart);
}

export async function addCartItem(_req: Request, res: Response): Promise<void> {
  const { cartId } = res.locals.validatedParams as { cartId: string };
  const body = res.locals.validatedBody as {
    productId: string;
    variantId?: string;
    quantity: number;
  };
  const cart = await cartService.addItem(cartId, body);
  ok(res, cart);
}

export async function updateCartItem(_req: Request, res: Response): Promise<void> {
  const { cartId, itemId } = res.locals.validatedParams as { cartId: string; itemId: string };
  const { quantity } = res.locals.validatedBody as { quantity: number };
  const cart = await cartService.updateItemQuantity(cartId, itemId, quantity);
  ok(res, cart);
}

export async function removeCartItem(_req: Request, res: Response): Promise<void> {
  const { cartId, itemId } = res.locals.validatedParams as { cartId: string; itemId: string };
  const cart = await cartService.removeItem(cartId, itemId);
  ok(res, cart);
}

export async function clearCart(_req: Request, res: Response): Promise<void> {
  const { cartId } = res.locals.validatedParams as { cartId: string };
  const cart = await cartService.clearCart(cartId);
  ok(res, cart);
}
