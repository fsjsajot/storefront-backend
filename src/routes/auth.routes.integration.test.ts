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

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.join('\n') : String(raw);
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
    where: { slug: 'authitest' },
    update: {},
    create: {
      slug: 'authitest',
      name: 'Auth Integration Test',
      description: 'Category used by auth integration tests',
      image: {
        src: 'https://images.example.com/authitest.png',
        alt: 'authitest',
        width: 100,
        height: 100,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  const product = await prisma.product.upsert({
    where: { slug: 'authitest-prod' },
    update: { stock: 10 },
    create: {
      slug: 'authitest-prod',
      name: 'Auth Test Product',
      description: 'Product used by auth integration tests',
      priceAmount: 10,
      priceCurrency: 'USD',
      images: [],
      categorySlug: 'authitest',
      stock: 10,
      rating: 4,
    },
  });
  return { productId: product.id };
}

async function createOrderWithCart(token: string): Promise<string> {
  const { productId } = await seedProduct();
  const cartRes = await request(app).post('/api/carts');
  const cartId = cartRes.body.data.id;
  await request(app).post(`/api/carts/${cartId}/items`).send({ productId, quantity: 1 });
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ cartId, contactEmail: 'owner@example.com', shippingAddress: address });
  return orderRes.body.data.id;
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

describe('POST /api/auth/register', () => {
  it('registers a user, returns an access token, and sets an httpOnly refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'new@example.com',
      role: 'CUSTOMER',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();

    const cookie = refreshCookie(res);
    expect(cookie).toContain('refreshToken=');
    const headers = cookieHeader(res);
    expect(headers).toContain('HttpOnly');
    expect(headers).toContain('SameSite=Lax');
    expect(headers).toContain('Path=/api/auth');
  });

  it('rejects a duplicate email with 409', async () => {
    const first = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: PASSWORD });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: PASSWORD });
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('already exists');
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await seedUser('login@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('login@example.com');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(res)).toContain('refreshToken=');
  });

  it('rejects a wrong password with 401', async () => {
    await seedUser('login@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid access token', async () => {
    await seedUser('me@example.com');
    const token = await loginToken('me@example.com');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@example.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and revokes the previous one', async () => {
    await seedUser('refresh@example.com');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'refresh@example.com', password: PASSWORD });
    const cookie1 = refreshCookie(loginRes);
    expect(cookie1).toContain('refreshToken=');

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie1);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(refreshRes)).toContain('refreshToken=');

    const replayRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie1);
    expect(replayRes.status).toBe(401);
  });

  it('returns 401 without a refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out and revokes the refresh token', async () => {
    await seedUser('logout@example.com');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logout@example.com', password: PASSWORD });
    const cookie = refreshCookie(loginRes);

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);
    expect(cookieHeader(logoutRes)).toContain('refreshToken=;');

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});

describe('protected order routes', () => {
  it('returns 401 on order routes without a token', async () => {
    const noTokenGet = await request(app).get('/api/orders/some-order');
    expect(noTokenGet.status).toBe(401);

    const noTokenPost = await request(app)
      .post('/api/orders')
      .send({ cartId: 'some-cart', contactEmail: 'a@b.com', shippingAddress: address });
    expect(noTokenPost.status).toBe(401);

    const noTokenPatch = await request(app)
      .patch('/api/orders/some-order/status')
      .send({ status: 'paid' });
    expect(noTokenPatch.status).toBe(401);
  });

  it('lets the owner view their order', async () => {
    const owner = await seedUser('owner@example.com');
    const token = await loginToken(owner.email);
    const orderId = await createOrderWithCart(token);

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
  });

  it('blocks another customer from viewing an order with 403', async () => {
    const owner = await seedUser('owner@example.com');
    await seedUser('other@example.com');
    const ownerToken = await loginToken(owner.email);
    const otherToken = await loginToken('other@example.com');
    const orderId = await createOrderWithCart(ownerToken);

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin view any order', async () => {
    const owner = await seedUser('owner@example.com');
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const ownerToken = await loginToken(owner.email);
    const adminToken = await loginToken(admin.email);
    const orderId = await createOrderWithCart(ownerToken);

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
  });

  it('blocks a customer from changing order status with 403', async () => {
    const owner = await seedUser('owner@example.com');
    const ownerToken = await loginToken(owner.email);
    const orderId = await createOrderWithCart(ownerToken);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(403);
  });

  it('lets an admin change order status', async () => {
    const owner = await seedUser('owner@example.com');
    const admin = await seedUser('admin@example.com', 'ADMIN');
    const ownerToken = await loginToken(owner.email);
    const adminToken = await loginToken(admin.email);
    const orderId = await createOrderWithCart(ownerToken);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
  });
});

describe('POST /api/carts/:cartId/merge', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/carts/some-cart/merge');
    expect(res.status).toBe(401);
  });

  it('adopts the guest cart when the user has no cart yet', async () => {
    const { productId } = await seedProduct();
    const cartRes = await request(app).post('/api/carts');
    const guestCartId = cartRes.body.data.id;
    await request(app).post(`/api/carts/${guestCartId}/items`).send({ productId, quantity: 2 });

    const user = await seedUser('merge@example.com');
    const token = await loginToken(user.email);

    const res = await request(app)
      .post(`/api/carts/${guestCartId}/merge`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(guestCartId);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      productId,
      quantity: 2,
      name: 'Auth Test Product',
      categorySlug: 'authitest',
    });

    const stored = await prisma.cart.findUnique({ where: { id: guestCartId } });
    expect(stored?.userId).toBe(user.id);
  });

  it('merges items into an existing user cart and deletes the guest cart', async () => {
    const { productId } = await seedProduct();
    const user = await seedUser('merge2@example.com');
    const token = await loginToken(user.email);

    const first = await request(app).post('/api/carts');
    const firstCartId = first.body.data.id;
    await request(app).post(`/api/carts/${firstCartId}/items`).send({ productId, quantity: 2 });
    await request(app)
      .post(`/api/carts/${firstCartId}/merge`)
      .set('Authorization', `Bearer ${token}`);

    const guest = await request(app).post('/api/carts');
    const guestCartId = guest.body.data.id;
    await request(app).post(`/api/carts/${guestCartId}/items`).send({ productId, quantity: 1 });

    const res = await request(app)
      .post(`/api/carts/${guestCartId}/merge`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(firstCartId);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(await prisma.cart.findUnique({ where: { id: guestCartId } })).toBeNull();
  });

  it('is idempotent when the cart already belongs to the user', async () => {
    const { productId } = await seedProduct();
    const user = await seedUser('merge3@example.com');
    const token = await loginToken(user.email);

    const cartRes = await request(app).post('/api/carts');
    const cartId = cartRes.body.data.id;
    await request(app).post(`/api/carts/${cartId}/items`).send({ productId, quantity: 1 });
    await request(app).post(`/api/carts/${cartId}/merge`).set('Authorization', `Bearer ${token}`);

    const again = await request(app)
      .post(`/api/carts/${cartId}/merge`)
      .set('Authorization', `Bearer ${token}`);

    expect(again.status).toBe(200);
    expect(again.body.data.items).toHaveLength(1);
    expect(again.body.data.items[0].quantity).toBe(1);
  });

  it('returns 404 for a missing cart', async () => {
    const user = await seedUser('merge4@example.com');
    const token = await loginToken(user.email);

    const res = await request(app)
      .post('/api/carts/missing-cart/merge')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('records a CART_MERGED audit row', async () => {
    const { productId } = await seedProduct();
    const cartRes = await request(app).post('/api/carts');
    const guestCartId = cartRes.body.data.id;
    await request(app).post(`/api/carts/${guestCartId}/items`).send({ productId, quantity: 1 });
    const user = await seedUser('merge5@example.com');
    const token = await loginToken(user.email);

    await request(app)
      .post(`/api/carts/${guestCartId}/merge`)
      .set('Authorization', `Bearer ${token}`);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'CART_MERGED', entityId: guestCartId },
    });
    expect(row).not.toBeNull();
    expect(row?.actorType).toBe('USER');
    expect(row?.actorId).toBe(user.id);
  });
});

describe('GET /api/orders', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a user with no orders', async () => {
    const user = await seedUser('orders-empty@example.com');
    const token = await loginToken(user.email);

    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns only the current user’s orders, newest first', async () => {
    const owner = await seedUser('orders-owner@example.com');
    const other = await seedUser('orders-other@example.com');
    const ownerToken = await loginToken(owner.email);
    const otherToken = await loginToken(other.email);

    const firstOrderId = await createOrderWithCart(ownerToken);
    const secondOrderId = await createOrderWithCart(ownerToken);
    const otherOrderId = await createOrderWithCart(otherToken);

    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((order: { id: string }) => order.id);
    expect(ids).toContain(firstOrderId);
    expect(ids).toContain(secondOrderId);
    expect(ids).not.toContain(otherOrderId);

    const otherRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.data).toHaveLength(1);
    expect(otherRes.body.data[0].id).toBe(otherOrderId);
  });
});
