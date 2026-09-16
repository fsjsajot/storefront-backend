import {
  cartRepository,
  type CartItemRow,
  type CartWithItems,
  type VariantRow,
} from '../repositories/cart.repository.js';
import { ApiError } from '../utils/api-error.js';
import { computeTotals, TAX_RATE, type CartTotals } from '../utils/money.js';
import { recordAudit, type AuditActorType, type AuditContext } from './audit.service.js';

export { computeTotals, TAX_RATE };
export type { CartTotals };

export interface CartItemResponse {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  name: string;
  slug: string;
  categorySlug: string;
  image: { src: string; alt: string } | null;
  variantName?: string;
  availableStock: number;
}

export interface CartResponse {
  id: string;
  items: CartItemResponse[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

function serializeCart(cart: CartWithItems, totals: CartTotals): CartResponse {
  return {
    id: cart.id,
    items: cart.items.map((item) => {
      const product = item.product;
      const images = Array.isArray(product?.images)
        ? (product.images as { src: string; alt: string }[])
        : [];
      const image = images[0] ?? null;
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        name: product?.name ?? 'Unavailable product',
        slug: product?.slug ?? '',
        categorySlug: product?.categorySlug ?? '',
        image: image !== null ? { src: image.src, alt: image.alt } : null,
        variantName: item.variant?.name ?? undefined,
        availableStock: item.variant?.stock ?? product?.stock ?? 0,
      };
    }),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

function actorForCart(
  cartId: string,
  context?: AuditContext,
): { actorType: AuditActorType; actorId: string | null } {
  if (context?.actorType === 'USER') {
    return { actorType: 'USER', actorId: context.actorId ?? null };
  }
  return { actorType: 'GUEST', actorId: cartId };
}

async function requireCart(cartId: string): Promise<CartWithItems> {
  const cart = await cartRepository.findCartById(cartId);
  if (cart === null) {
    throw new ApiError(404, 'Cart not found');
  }
  return cart;
}

async function requireCartItem(cartId: string, itemId: string): Promise<CartItemRow> {
  const item = await cartRepository.findCartItemById(cartId, itemId);
  if (item === null) {
    throw new ApiError(404, 'Cart item not found');
  }
  return item;
}

function resolveVariant(variant: VariantRow | null, productId: string): VariantRow | null {
  if (variant === null) {
    return null;
  }
  if (variant.productId !== productId) {
    throw new ApiError(400, 'Variant does not belong to the given product');
  }
  return variant;
}

function resolvePriceAndStock(
  product: { priceAmount: number; priceCurrency: string; stock: number },
  variant: VariantRow | null,
): { unitPrice: number; currency: string; availableStock: number } {
  if (variant !== null && variant.priceAmount !== null && variant.priceCurrency !== null) {
    return {
      unitPrice: variant.priceAmount,
      currency: variant.priceCurrency,
      availableStock: variant.stock,
    };
  }
  return {
    unitPrice: product.priceAmount,
    currency: product.priceCurrency,
    availableStock: variant !== null ? variant.stock : product.stock,
  };
}

async function serializeAfterMutation(cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  const totals = computeTotals(cart.items);
  await cartRepository.updateCartTotals(cartId, totals);
  const fresh = await cartRepository.findCartById(cartId);
  if (fresh === null) {
    throw new ApiError(404, 'Cart not found');
  }
  return serializeCart(fresh, totals);
}

export async function createCart(context?: AuditContext): Promise<CartResponse> {
  const cart = await cartRepository.createCart();
  const result = serializeCart(cart, computeTotals(cart.items));
  const actor = actorForCart(cart.id, context);
  await recordAudit({
    entityType: 'Cart',
    entityId: cart.id,
    action: 'CART_CREATED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    context,
  });
  return result;
}

export async function getCart(cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  return serializeCart(cart, computeTotals(cart.items));
}

export async function addItem(
  cartId: string,
  input: { productId: string; variantId?: string; quantity: number },
  context?: AuditContext,
): Promise<CartResponse> {
  await requireCart(cartId);

  const product = await cartRepository.findProductById(input.productId);
  if (product === null) {
    throw new ApiError(404, 'Product not found');
  }

  let variant: VariantRow | null = null;
  if (input.variantId !== undefined) {
    const found = await cartRepository.findVariantById(input.variantId);
    if (found === null) {
      throw new ApiError(404, 'Variant not found');
    }
    variant = resolveVariant(found, product.id);
  }

  const { unitPrice, currency, availableStock } = resolvePriceAndStock(product, variant);
  if (availableStock <= 0) {
    throw new ApiError(409, 'Item is out of stock');
  }

  const existing = await cartRepository.findCartItemByProductAndVariant(
    cartId,
    product.id,
    variant?.id ?? null,
  );
  const requested = existing !== null ? existing.quantity + input.quantity : input.quantity;
  const quantity = Math.min(requested, availableStock);

  if (existing !== null) {
    await cartRepository.updateCartItemQuantity(existing.id, quantity);
  } else {
    await cartRepository.createCartItem({
      cartId,
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
      unitPrice,
      currency,
    });
  }

  const result = await serializeAfterMutation(cartId);
  const actor = actorForCart(cartId, context);
  await recordAudit({
    entityType: 'Cart',
    entityId: cartId,
    action: 'CART_ITEM_ADDED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    metadata: {
      productId: product.id,
      ...(variant !== null ? { variantId: variant.id } : {}),
      quantity,
    },
    context,
  });
  return result;
}

export async function updateItemQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
  context?: AuditContext,
): Promise<CartResponse> {
  await requireCart(cartId);
  const item = await requireCartItem(cartId, itemId);

  const product = await cartRepository.findProductById(item.productId);
  if (product === null) {
    throw new ApiError(404, 'Product not found');
  }

  let variant: VariantRow | null = null;
  if (item.variantId !== null) {
    const found = await cartRepository.findVariantById(item.variantId);
    if (found === null) {
      throw new ApiError(404, 'Variant not found');
    }
    variant = found;
  }

  const { availableStock } = resolvePriceAndStock(product, variant);
  if (availableStock <= 0) {
    throw new ApiError(409, 'Item is out of stock');
  }

  await cartRepository.updateCartItemQuantity(itemId, Math.min(quantity, availableStock));
  const result = await serializeAfterMutation(cartId);
  const actor = actorForCart(cartId, context);
  await recordAudit({
    entityType: 'Cart',
    entityId: cartId,
    action: 'CART_ITEM_UPDATED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    metadata: { itemId, quantity },
    context,
  });
  return result;
}

export async function removeItem(
  cartId: string,
  itemId: string,
  context?: AuditContext,
): Promise<CartResponse> {
  await requireCart(cartId);
  await requireCartItem(cartId, itemId);
  await cartRepository.deleteCartItem(itemId);
  const result = await serializeAfterMutation(cartId);
  const actor = actorForCart(cartId, context);
  await recordAudit({
    entityType: 'Cart',
    entityId: cartId,
    action: 'CART_ITEM_REMOVED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    metadata: { itemId },
    context,
  });
  return result;
}

export async function clearCart(cartId: string, context?: AuditContext): Promise<CartResponse> {
  await requireCart(cartId);
  await cartRepository.deleteCartItems(cartId);
  await cartRepository.updateCartTotals(cartId, { subtotal: 0, tax: 0, total: 0 });
  const cart = await requireCart(cartId);
  const result = serializeCart(cart, { subtotal: 0, tax: 0, total: 0 });
  const actor = actorForCart(cartId, context);
  await recordAudit({
    entityType: 'Cart',
    entityId: cartId,
    action: 'CART_CLEARED',
    actorType: actor.actorType,
    actorId: actor.actorId,
    context,
  });
  return result;
}

export async function mergeCart(
  guestCartId: string,
  userId: string,
  context?: AuditContext,
): Promise<CartResponse> {
  const guestCart = await cartRepository.findCartById(guestCartId);
  if (guestCart === null) {
    throw new ApiError(404, 'Cart not found');
  }

  const userCart = await cartRepository.findCartByUserId(userId);

  let mergedCartId = guestCart.id;
  if (userCart === null) {
    await cartRepository.setCartUserId(guestCart.id, userId);
  } else if (userCart.id !== guestCart.id) {
    for (const guestItem of guestCart.items) {
      const product = await cartRepository.findProductById(guestItem.productId);
      if (product === null) {
        continue;
      }

      let variant: VariantRow | null = null;
      if (guestItem.variantId !== null) {
        const found = await cartRepository.findVariantById(guestItem.variantId);
        if (found !== null) {
          variant = resolveVariant(found, product.id);
        }
      }

      const { unitPrice, currency, availableStock } = resolvePriceAndStock(product, variant);
      if (availableStock <= 0) {
        continue;
      }

      const existing = await cartRepository.findCartItemByProductAndVariant(
        userCart.id,
        product.id,
        variant?.id ?? null,
      );
      const requested =
        existing !== null ? existing.quantity + guestItem.quantity : guestItem.quantity;
      const quantity = Math.min(requested, availableStock);

      if (existing !== null) {
        await cartRepository.updateCartItemQuantity(existing.id, quantity);
      } else {
        await cartRepository.createCartItem({
          cartId: userCart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity,
          unitPrice,
          currency,
        });
      }
    }
    await cartRepository.deleteCart(guestCart.id);
    mergedCartId = userCart.id;
  }

  const result = await serializeAfterMutation(mergedCartId);
  await recordAudit({
    entityType: 'Cart',
    entityId: mergedCartId,
    action: 'CART_MERGED',
    actorType: 'USER',
    actorId: userId,
    metadata: { sourceCartId: guestCart.id },
    context,
  });
  return result;
}

export const cartService = {
  createCart,
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeCart,
};
