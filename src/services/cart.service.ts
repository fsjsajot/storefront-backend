import {
  cartRepository,
  type CartItemRow,
  type CartWithItems,
  type VariantRow,
} from '../repositories/cart.repository.js';
import { ApiError } from '../utils/api-error.js';
import { computeTotals, TAX_RATE, type CartTotals } from '../utils/money.js';

export { computeTotals, TAX_RATE };
export type { CartTotals };

export interface CartItemResponse {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
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
    items: cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
    })),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
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

export async function createCart(): Promise<CartResponse> {
  const cart = await cartRepository.createCart();
  return serializeCart(cart, computeTotals(cart.items));
}

export async function getCart(cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  return serializeCart(cart, computeTotals(cart.items));
}

export async function addItem(
  cartId: string,
  input: { productId: string; variantId?: string; quantity: number },
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

  return serializeAfterMutation(cartId);
}

export async function updateItemQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
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
  return serializeAfterMutation(cartId);
}

export async function removeItem(cartId: string, itemId: string): Promise<CartResponse> {
  await requireCart(cartId);
  await requireCartItem(cartId, itemId);
  await cartRepository.deleteCartItem(itemId);
  return serializeAfterMutation(cartId);
}

export async function clearCart(cartId: string): Promise<CartResponse> {
  await requireCart(cartId);
  await cartRepository.deleteCartItems(cartId);
  await cartRepository.updateCartTotals(cartId, { subtotal: 0, tax: 0, total: 0 });
  const cart = await requireCart(cartId);
  return serializeCart(cart, { subtotal: 0, tax: 0, total: 0 });
}

export const cartService = {
  createCart,
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
