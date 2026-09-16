import { spawn, type ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(e2eDir, '..');
const storefrontDir = path.resolve(backendDir, '../storefront');

const E2E_DB = 'file:./e2e.db';
const BACKEND_PORT = 4100;
const STOREFRONT_PORT = 3100;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const STOREFRONT_URL = `http://localhost:${STOREFRONT_PORT}`;

const prismaCli = path.join(backendDir, 'node_modules/prisma/build/index.js');
const tsxCli = path.join(backendDir, 'node_modules/tsx/dist/cli.mjs');
const nextCli = path.join(storefrontDir, 'node_modules/next/dist/bin/next');

const PASSWORD = 'password123';
const ADDRESS = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  line1: '1 Test St',
  city: 'London',
  postalCode: 'SW1A 1AA',
  country: 'GB',
};

let backendProcess: ChildProcess | null = null;
let storefrontProcess: ChildProcess | null = null;

function runNode(args: string[], cwd: string, extraEnv: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: 'pipe',
    });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`command failed (${code}): ${args.join(' ')}\n${output}`));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status >= 200 && res.status < 500) {
        return;
      }
      lastError = new Error(`unexpected status ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`server at ${url} did not become ready: ${String(lastError)}`);
}

function stop(child: ChildProcess | null): Promise<void> {
  if (child === null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 4000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

interface ApiCallOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function api(pathname: string, options: ApiCallOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token !== undefined) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  return fetch(`${BACKEND_URL}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const get = (pathname: string, token?: string) => api(pathname, { token });
const post = (pathname: string, body: unknown, token?: string) =>
  api(pathname, { method: 'POST', body, token });
const patch = (pathname: string, body: unknown, token?: string) =>
  api(pathname, { method: 'PATCH', body, token });

describe('e2e: register -> login -> browse -> search -> cart -> merge -> checkout -> history -> admin', () => {
  let customerToken = '';
  let customerId = '';
  let guestCartId = '';
  let productId = '';
  let orderId = '';
  let adminToken = '';

  beforeAll(async () => {
    await rm(path.join(backendDir, 'e2e.db'), { force: true });
    await rm(path.join(backendDir, 'e2e.db-journal'), { force: true });

    await runNode([prismaCli, 'migrate', 'deploy'], backendDir, { DATABASE_URL: E2E_DB });

    const passwordHash = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: { email: 'admin@e2e.com', passwordHash, role: 'ADMIN' },
    });

    await prisma.category.create({
      data: {
        slug: 'e2e-audio',
        name: 'E2E Audio',
        description: 'E2E category',
        image: {
          src: 'https://images.example.com/e2e/audio.webp',
          alt: 'E2E Audio',
          width: 1200,
          height: 900,
        } as never,
      },
    });
    const product = await prisma.product.create({
      data: {
        slug: 'e2e-earbuds',
        name: 'E2E Earbuds',
        description: 'E2E test earbuds',
        priceAmount: 99.99,
        priceCurrency: 'USD',
        images: [
          {
            src: 'https://images.example.com/e2e/earbuds.webp',
            alt: 'E2E Earbuds',
            width: 1200,
            height: 900,
          },
        ],
        categorySlug: 'e2e-audio',
        stock: 50,
        rating: 4.5,
      },
    });
    productId = product.id;

    backendProcess = spawn(process.execPath, [tsxCli, 'src/server.ts'], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DB,
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'e2e-access-secret',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret',
      },
      stdio: 'ignore',
    });
    await waitForServer(`${BACKEND_URL}/health`);

    storefrontProcess = spawn(process.execPath, [nextCli, 'dev', '-p', String(STOREFRONT_PORT)], {
      cwd: storefrontDir,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: BACKEND_URL,
        NEXT_PUBLIC_SITE_URL: STOREFRONT_URL,
      },
      stdio: 'ignore',
    });
    await waitForServer(`${STOREFRONT_URL}/login`);
  }, 240_000);

  afterAll(async () => {
    await stop(storefrontProcess);
    await stop(backendProcess);
    await prisma.$disconnect();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(path.join(backendDir, 'e2e.db'), { force: true }).catch(() => undefined);
    await rm(path.join(backendDir, 'e2e.db-journal'), { force: true }).catch(() => undefined);
  });

  it('runs the full customer journey against live backend + storefront', async () => {
    // browse
    const productsRes = await get('/api/products?page=1&pageSize=100');
    expect(productsRes.status).toBe(200);
    const catalog = (await productsRes.json()) as { data: { id: string; slug: string }[] };
    expect(catalog.data.some((p) => p.slug === 'e2e-earbuds')).toBe(true);

    const categoriesRes = await get('/api/categories');
    expect(categoriesRes.status).toBe(200);

    // search
    const searchRes = await get('/api/search?q=earbuds');
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { items: unknown[]; total: number };
    expect(searchBody.total).toBeGreaterThan(0);

    // register
    const email = `cust-${Date.now()}@e2e.com`;
    const registerRes = await post('/api/auth/register', { email, password: PASSWORD });
    expect(registerRes.status).toBe(201);
    const registerBody = (await registerRes.json()) as {
      data: { user: { id: string }; accessToken: string };
    };
    customerToken = registerBody.data.accessToken;
    customerId = registerBody.data.user.id;
    expect(customerId).toBeTruthy();

    // login
    const loginRes = await post('/api/auth/login', { email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { accessToken: string } };
    expect(loginBody.data.accessToken).toBeTruthy();

    // guest cart
    const cartRes = await post('/api/carts', {});
    expect(cartRes.status).toBe(200);
    const cart = (await cartRes.json()) as { data: { id: string } };
    guestCartId = cart.data.id;

    const addRes = await post(`/api/carts/${guestCartId}/items`, {
      productId,
      quantity: 2,
    });
    expect(addRes.status).toBe(200);
    const addBody = (await addRes.json()) as { data: { items: { quantity: number }[] } };
    expect(addBody.data.items).toHaveLength(1);
    expect(addBody.data.items[0].quantity).toBe(2);

    // login merges the guest cart
    const mergeRes = await post(`/api/carts/${guestCartId}/merge`, {}, customerToken);
    expect(mergeRes.status).toBe(200);
    const merged = (await mergeRes.json()) as {
      data: { id: string; items: { quantity: number }[] };
    };
    expect(merged.data.id).toBe(guestCartId);
    expect(merged.data.items[0].quantity).toBe(2);

    const storedCart = await prisma.cart.findUnique({ where: { id: guestCartId } });
    expect(storedCart?.userId).toBe(customerId);

    // checkout
    const orderRes = await post(
      '/api/orders',
      { cartId: guestCartId, contactEmail: email, shippingAddress: ADDRESS },
      customerToken,
    );
    expect(orderRes.status).toBe(201);
    const order = (await orderRes.json()) as {
      data: { id: string; status: string; cartId: string };
    };
    orderId = order.data.id;
    expect(order.data.status).toBe('pending');
    expect(order.data.cartId).toBe(guestCartId);

    const storedOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(storedOrder?.userId).toBe(customerId);

    // order history
    const ordersRes = await get('/api/orders', customerToken);
    expect(ordersRes.status).toBe(200);
    const orders = (await ordersRes.json()) as { data: { id: string }[] };
    expect(orders.data.some((o) => o.id === orderId)).toBe(true);

    const detailRes = await get(`/api/orders/${orderId}`, customerToken);
    expect(detailRes.status).toBe(200);

    // admin login, audit log, status change
    const adminLoginRes = await post('/api/auth/login', {
      email: 'admin@e2e.com',
      password: PASSWORD,
    });
    expect(adminLoginRes.status).toBe(200);
    adminToken = ((await adminLoginRes.json()) as { data: { accessToken: string } }).data
      .accessToken;

    const auditRes = await get(`/api/orders/${orderId}/audit-log`, adminToken);
    expect(auditRes.status).toBe(200);
    const auditRows = (await auditRes.json()) as { data: { action: string; entityId: string }[] };
    expect(auditRows.data.some((r) => r.action === 'ORDER_CREATED' && r.entityId === orderId)).toBe(
      true,
    );

    const adminAuditLogRes = await get(
      `/api/audit-log?entityType=Order&entityId=${orderId}`,
      adminToken,
    );
    expect(adminAuditLogRes.status).toBe(200);

    const patchRes = await patch(`/api/orders/${orderId}/status`, { status: 'paid' }, adminToken);
    expect(patchRes.status).toBe(200);
    expect(((await patchRes.json()) as { data: { status: string } }).data.status).toBe('paid');

    // customer forbidden from admin-only status change
    const forbiddenRes = await patch(
      `/api/orders/${orderId}/status`,
      { status: 'fulfilled' },
      customerToken,
    );
    expect(forbiddenRes.status).toBe(403);

    // audit rows recorded
    const created = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_CREATED', entityId: orderId },
    });
    expect(created).not.toBeNull();
    expect(created?.actorType).toBe('USER');
    expect(created?.actorId).toBe(customerId);

    const changed = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_STATUS_CHANGED', entityId: orderId },
    });
    expect(changed?.metadata).toMatchObject({ from: 'pending', to: 'paid' });

    const mergedAudit = await prisma.auditLog.findFirst({
      where: { action: 'CART_MERGED', entityId: guestCartId },
    });
    expect(mergedAudit).not.toBeNull();

    // storefront serves live pages against the spun-up backend
    const sfProducts = await fetch(`${STOREFRONT_URL}/products`);
    const sfProductsHtml = await sfProducts.text();
    expect(sfProducts.status).toBe(200);
    expect(sfProductsHtml).toContain('E2E Earbuds');

    const sfSearch = await fetch(`${STOREFRONT_URL}/search?q=earbuds`);
    expect(sfSearch.status).toBe(200);

    const sfOrders = await fetch(`${STOREFRONT_URL}/account/orders`);
    expect(sfOrders.status).toBe(200);
  }, 120_000);
});
