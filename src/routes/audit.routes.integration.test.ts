import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import type { Address } from '../models/index.js';
import { hashPassword } from '../utils/password.js';

const app: Express = createApp();
const PASSWORD = 'password123';

const address: Address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  line1: '1 Analytical Way',
  city: 'London',
  postalCode: 'SW1A 1AA',
  country: 'GB',
};

function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw].filter((v) => typeof v === 'string');
  return (
    list.map((cookie) => cookie.split(';')[0]).find((c) => c.startsWith('refreshToken=')) ?? ''
  );
}

async function seedUser(email: string, role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
  return prisma.user.create({
    data: { email, passwordHash: await hashPassword(PASSWORD), role },
  });
}

async function loginToken(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.accessToken;
}

async function seedProduct(): Promise<{ productId: string }> {
  await prisma.category.upsert({
    where: { slug: 'audititest' },
    update: {},
    create: {
      slug: 'audititest',
      name: 'Audit Integration Test',
      description: 'Category used by audit integration tests',
      image: {
        src: 'https://images.example.com/audititest.png',
        alt: 'audititest',
        width: 100,
        height: 100,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  const product = await prisma.product.create({
    data: {
      slug: 'audititest-prod',
      name: 'Audit Test Product',
      description: 'Product used by audit integration tests',
      priceAmount: 10,
      priceCurrency: 'USD',
      images: [],
      categorySlug: 'audititest',
      stock: 10,
      rating: 4,
    },
  });
  return { productId: product.id };
}

async function createOrderFor(token: string): Promise<{ orderId: string }> {
  const { productId } = await seedProduct();
  const cartRes = await request(app).post('/api/carts');
  const cartId = cartRes.body.data.id;
  await request(app).post(`/api/carts/${cartId}/items`).send({ productId, quantity: 1 });
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ cartId, contactEmail: 'owner@example.com', shippingAddress: address });
  return { orderId: orderRes.body.data.id };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('audit rows for auth actions', () => {
  it('records REGISTER and LOGIN_SUCCESS rows', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', password: PASSWORD });
    const userId = registerRes.body.data.user.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: PASSWORD });
    expect(loginRes.status).toBe(200);

    const registerRow = await prisma.auditLog.findFirst({
      where: { action: 'REGISTER', entityId: userId },
    });
    expect(registerRow).not.toBeNull();
    expect(registerRow?.actorType).toBe('USER');
    expect(registerRow?.actorId).toBe(userId);

    const loginRow = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_SUCCESS', entityId: userId },
    });
    expect(loginRow).not.toBeNull();
    expect(loginRow?.actorType).toBe('USER');
    expect(loginRow?.actorId).toBe(userId);
  });

  it('records LOGIN_FAILED for a wrong password', async () => {
    const user = await seedUser('b@example.com');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'b@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_FAILED', entityId: user.id },
    });
    expect(row).not.toBeNull();
    expect(row?.actorType).toBe('GUEST');
    expect(row?.actorId).toBeNull();
    expect(row?.metadata).toMatchObject({ email: 'b@example.com', reason: 'wrong_password' });
  });

  it('records LOGIN_FAILED for an unknown email', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: PASSWORD });

    const row = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_FAILED', entityId: 'ghost@example.com' },
    });
    expect(row).not.toBeNull();
    expect(row?.actorType).toBe('GUEST');
  });

  it('records a LOGOUT row', async () => {
    const user = await seedUser('c@example.com');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'c@example.com', password: PASSWORD });
    const cookie = refreshCookie(loginRes);

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'LOGOUT', entityId: user.id },
    });
    expect(row).not.toBeNull();
    expect(row?.actorType).toBe('USER');
    expect(row?.actorId).toBe(user.id);
  });
});

describe('audit rows for cart actions', () => {
  it('records create/add/update/remove/clear rows for a guest cart', async () => {
    const { productId } = await seedProduct();

    const createRes = await request(app).post('/api/carts');
    const cartId = createRes.body.data.id;

    const addRes = await request(app)
      .post(`/api/carts/${cartId}/items`)
      .send({ productId, quantity: 2 });
    const itemId = addRes.body.data.items[0].id;

    await request(app).patch(`/api/carts/${cartId}/items/${itemId}`).send({ quantity: 3 });
    await request(app).delete(`/api/carts/${cartId}/items/${itemId}`);
    await request(app).delete(`/api/carts/${cartId}`);

    const created = await prisma.auditLog.findFirst({
      where: { action: 'CART_CREATED', entityId: cartId },
    });
    expect(created).not.toBeNull();
    expect(created?.actorType).toBe('GUEST');
    expect(created?.actorId).toBe(cartId);

    const added = await prisma.auditLog.findFirst({
      where: { action: 'CART_ITEM_ADDED', entityId: cartId },
    });
    expect(added?.metadata).toMatchObject({ productId, quantity: 2 });

    const updated = await prisma.auditLog.findFirst({
      where: { action: 'CART_ITEM_UPDATED', entityId: cartId },
    });
    expect(updated?.metadata).toMatchObject({ itemId, quantity: 3 });

    const removed = await prisma.auditLog.findFirst({
      where: { action: 'CART_ITEM_REMOVED', entityId: cartId },
    });
    expect(removed?.metadata).toMatchObject({ itemId });

    const cleared = await prisma.auditLog.findFirst({
      where: { action: 'CART_CLEARED', entityId: cartId },
    });
    expect(cleared).not.toBeNull();
    expect(cleared?.actorType).toBe('GUEST');
    expect(cleared?.actorId).toBe(cartId);
  });
});

describe('audit rows for order actions', () => {
  it('records ORDER_CREATED and ORDER_STATUS_CHANGED rows', async () => {
    const owner = await seedUser('owner@example.com');
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const ownerToken = await loginToken(owner.email);
    const adminToken = await loginToken(admin.email);

    const { orderId } = await createOrderFor(ownerToken);

    const created = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_CREATED', entityId: orderId },
    });
    expect(created).not.toBeNull();
    expect(created?.actorType).toBe('USER');
    expect(created?.actorId).toBe(owner.id);

    const patchRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paid' });
    expect(patchRes.status).toBe(200);

    const changed = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_STATUS_CHANGED', entityId: orderId },
    });
    expect(changed).not.toBeNull();
    expect(changed?.actorType).toBe('USER');
    expect(changed?.actorId).toBe(admin.id);
    expect(changed?.metadata).toMatchObject({ from: 'pending', to: 'paid' });
  });
});

describe('GET /api/audit-log authorization', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a customer', async () => {
    const customer = await seedUser('customer@example.com');
    const token = await loginToken(customer.email);

    const res = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin list audit logs', async () => {
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const adminToken = await loginToken(admin.email);
    const owner = await seedUser('owner@example.com');
    const { orderId } = await createOrderFor(await loginToken(owner.email));

    const res = await request(app)
      .get('/api/audit-log')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.some((row: { action: string; entityId: string }) => {
        return row.action === 'ORDER_CREATED' && row.entityId === orderId;
      }),
    ).toBe(true);
  });

  it('filters audit logs by entityType, entityId and date range', async () => {
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const adminToken = await loginToken(admin.email);
    const owner = await seedUser('owner@example.com');
    const { orderId } = await createOrderFor(await loginToken(owner.email));

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(app)
      .get(
        `/api/audit-log?entityType=Order&entityId=${orderId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].entityType).toBe('Order');
    expect(res.body.data[0].entityId).toBe(orderId);
  });
});

describe('GET /api/orders/:orderId/audit-log authorization', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/orders/some-order/audit-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-owner customer', async () => {
    const owner = await seedUser('owner@example.com');
    const other = await seedUser('other@example.com');
    const { orderId } = await createOrderFor(await loginToken(owner.email));
    const otherToken = await loginToken(other.email);

    const res = await request(app)
      .get(`/api/orders/${orderId}/audit-log`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('lets the owner view their order audit log', async () => {
    const owner = await seedUser('owner@example.com');
    const ownerToken = await loginToken(owner.email);
    const { orderId } = await createOrderFor(ownerToken);

    const res = await request(app)
      .get(`/api/orders/${orderId}/audit-log`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((row: { entityType: string; entityId: string }) => {
        return row.entityType === 'Order' && row.entityId === orderId;
      }),
    ).toBe(true);
  });

  it('lets an admin view any order audit log', async () => {
    const owner = await seedUser('owner@example.com');
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const { orderId } = await createOrderFor(await loginToken(owner.email));
    const adminToken = await loginToken(admin.email);

    const res = await request(app)
      .get(`/api/orders/${orderId}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
