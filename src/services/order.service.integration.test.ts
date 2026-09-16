import { Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import type { Address } from '../models/index.js';
import { cartService } from './cart.service.js';
import { orderService } from './order.service.js';

const address: Address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  line1: '1 Analytical Way',
  city: 'London',
  postalCode: 'SW1A 1AA',
  country: 'GB',
};

async function seedCategory(): Promise<void> {
  await prisma.category.upsert({
    where: { slug: 'itest' },
    update: {},
    create: {
      slug: 'itest',
      name: 'Integration Test',
      description: 'Category used by integration tests',
      image: {
        src: 'https://images.example.com/itest.png',
        alt: 'itest',
        width: 100,
        height: 100,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function seedProduct(p: {
  slug: string;
  priceAmount: number;
  stock: number;
  variantStock?: number;
}): Promise<{ productId: string; variantId?: string }> {
  await seedCategory();
  const product = await prisma.product.create({
    data: {
      slug: p.slug,
      name: p.slug,
      description: p.slug,
      priceAmount: p.priceAmount,
      priceCurrency: 'USD',
      images: [],
      categorySlug: 'itest',
      stock: p.stock,
      rating: 4,
    },
  });
  let variantId: string | undefined;
  if (p.variantStock !== undefined) {
    const variant = await prisma.productVariant.create({
      data: {
        name: 'Default',
        sku: `${p.slug}-v1`,
        productId: product.id,
        priceAmount: null,
        priceCurrency: null,
        stock: p.variantStock,
      },
    });
    variantId = variant.id;
  }
  return { productId: product.id, variantId };
}

async function newCartWithItem(productId: string, quantity: number): Promise<string> {
  const cart = await cartService.createCart();
  await cartService.addItem(cart.id, { productId, quantity });
  return cart.id;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('order service: createOrder', () => {
  it('creates an order from a non-empty cart and decrements product stock', async () => {
    const { productId } = await seedProduct({ slug: 'itest-create', priceAmount: 10, stock: 5 });
    const cartId = await newCartWithItem(productId, 2);

    const order = await orderService.createOrder({
      cartId,
      contactEmail: 'ada@example.com',
      shippingAddress: address,
    });

    expect(order.id).toBeTruthy();
    expect(order.cartId).toBe(cartId);
    expect(order.status).toBe('pending');
    expect(order.contactEmail).toBe('ada@example.com');
    expect(order.shippingAddress).toEqual(address);
    expect(order.items).toEqual([{ productId, quantity: 2, unitPrice: 10, currency: 'USD' }]);
    expect(order.subtotal).toBe(20);
    expect(order.tax).toBe(1.65);
    expect(order.total).toBe(21.65);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(3);
  });

  it('decrements variant stock for variant items', async () => {
    const { productId, variantId } = await seedProduct({
      slug: 'itest-variant',
      priceAmount: 50,
      stock: 10,
      variantStock: 4,
    });
    const cart = await cartService.createCart();
    await cartService.addItem(cart.id, { productId, variantId, quantity: 2 });

    const order = await orderService.createOrder({
      cartId: cart.id,
      contactEmail: 'a@b.com',
      shippingAddress: address,
    });

    expect(order.items[0].variantId).toBe(variantId);
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant?.stock).toBe(2);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(10);
  });

  it('rejects an empty cart', async () => {
    const cart = await cartService.createCart();
    await expect(
      orderService.createOrder({
        cartId: cart.id,
        contactEmail: 'a@b.com',
        shippingAddress: address,
      }),
    ).rejects.toThrow(/empty cart/);
  });

  it('rejects a missing cart', async () => {
    await expect(
      orderService.createOrder({
        cartId: 'missing-cart',
        contactEmail: 'a@b.com',
        shippingAddress: address,
      }),
    ).rejects.toThrow('Cart not found');
  });

  it('rejects an order when stock is insufficient', async () => {
    const { productId } = await seedProduct({ slug: 'itest-lowstock', priceAmount: 10, stock: 3 });
    const cartId = await newCartWithItem(productId, 3);

    await prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: 3 } },
    });

    await expect(
      orderService.createOrder({ cartId, contactEmail: 'a@b.com', shippingAddress: address }),
    ).rejects.toThrow(/Insufficient stock/);

    expect(await prisma.order.count()).toBe(0);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(0);
  });

  it('rolls back stock decrements when order creation fails', async () => {
    const { productId } = await seedProduct({
      slug: 'itest-rollback',
      priceAmount: 10,
      stock: 100,
    });
    const cartId = await newCartWithItem(productId, 1);

    await orderService.createOrder({
      cartId,
      contactEmail: 'a@b.com',
      shippingAddress: address,
    });

    await expect(
      orderService.createOrder({ cartId, contactEmail: 'a@b.com', shippingAddress: address }),
    ).rejects.toThrow('An order already exists for this cart');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(99);
    expect(await prisma.order.count()).toBe(1);
  });

  it('rejects creating a second order for the same cart', async () => {
    const { productId } = await seedProduct({ slug: 'itest-dupe', priceAmount: 10, stock: 100 });
    const cartId = await newCartWithItem(productId, 1);

    await orderService.createOrder({
      cartId,
      contactEmail: 'a@b.com',
      shippingAddress: address,
    });
    await expect(
      orderService.createOrder({ cartId, contactEmail: 'a@b.com', shippingAddress: address }),
    ).rejects.toThrow('An order already exists for this cart');
  });
});

describe('order service: getOrder', () => {
  it('fetches an existing order', async () => {
    const { productId } = await seedProduct({ slug: 'itest-fetch', priceAmount: 10, stock: 10 });
    const cartId = await newCartWithItem(productId, 1);

    const created = await orderService.createOrder({
      cartId,
      contactEmail: 'a@b.com',
      shippingAddress: address,
    });

    const fetched = await orderService.getOrder(created.id);
    expect(fetched).toEqual(created);
  });

  it('returns null-safe 404 for a missing order', async () => {
    await expect(orderService.getOrder('missing-order')).rejects.toThrow('Order not found');
  });
});

describe('order service: updateOrderStatus', () => {
  async function createTestOrder(): Promise<{ orderId: string }> {
    const { productId } = await seedProduct({ slug: 'itest-status', priceAmount: 10, stock: 10 });
    const cartId = await newCartWithItem(productId, 1);
    const order = await orderService.createOrder({
      cartId,
      contactEmail: 'a@b.com',
      shippingAddress: address,
    });
    return { orderId: order.id };
  }

  it('walks pending -> paid -> fulfilled and rejects invalid steps', async () => {
    const { orderId } = await createTestOrder();

    await expect(orderService.updateOrderStatus(orderId, 'fulfilled')).rejects.toThrow(
      /Invalid status transition/,
    );
    expect((await orderService.updateOrderStatus(orderId, 'paid')).status).toBe('paid');
    await expect(orderService.updateOrderStatus(orderId, 'pending')).rejects.toThrow(
      /Invalid status transition/,
    );
    expect((await orderService.updateOrderStatus(orderId, 'fulfilled')).status).toBe('fulfilled');
    await expect(orderService.updateOrderStatus(orderId, 'cancelled')).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('allows cancelling from pending and paid, then blocks further transitions', async () => {
    const { orderId } = await createTestOrder();

    expect((await orderService.updateOrderStatus(orderId, 'cancelled')).status).toBe('cancelled');
    await expect(orderService.updateOrderStatus(orderId, 'paid')).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('rejects a missing order on status update', async () => {
    await expect(orderService.updateOrderStatus('missing-order', 'paid')).rejects.toThrow(
      'Order not found',
    );
  });
});
