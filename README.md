# Ecommerce Backend

A standalone REST API server for the ecommerce project. Built with Node.js, TypeScript, and Express, using Prisma with SQLite for persistence and Zod for validation.

## Features

- **Catalog** — categories and products with variants
- **Search** — full-text-ish filtering, sorting, and pagination over products
- **Carts** — anonymous, fully persisted carts with server-computed subtotal/tax/total (8.25% tax)
- **Orders** — order creation from a cart with atomic stock decrements, plus status transitions (`pending -> paid -> fulfilled`, or `cancelled`)
- **Auth** — email/password registration and login issuing a short-lived JWT access token (JSON) and a longer-lived refresh token in an `HttpOnly` cookie; token refresh with rotation and logout; role-based authorization (`CUSTOMER` / `ADMIN`)
- **Audit trail** — append-only audit logs for auth, cart, and order actions with actor context (user id, guest cart id, or system), IP/user-agent/request-id, and before/after metadata
- **Hardening** — centralized error handling, Helmet security headers, per-IP rate limiting on `/api`, pino structured request logging with request ids, an interactive Swagger UI at `/api/docs`, and a machine-readable OpenAPI spec at `GET /api/openapi.json`

## Requirements

- Node.js >= 20
- npm >= 10

## Setup

```bash
npm install

# Create the database schema (SQLite file at DATABASE_URL)
npm run db:migrate

# Seed the catalog (3 categories, 16 products)
npm run db:seed

# Start the dev server with hot reload
npm run dev
```

The server listens on `http://localhost:4000` by default.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable               | Default                 | Description                                     |
| ---------------------- | ----------------------- | ----------------------------------------------- |
| `PORT`                 | `4000`                  | HTTP port the server listens on                 |
| `NODE_ENV`             | `development`           | `development` or `production` (sets log level)  |
| `DATABASE_URL`         | `file:./dev.db`         | SQLite database file (Prisma connection URL)    |
| `FRONTEND_ORIGIN`      | `http://localhost:3000` | Allowed CORS origin (must match the storefront) |
| `RATE_LIMIT_WINDOW_MS` | `900000`                | Rate-limit window in milliseconds (15 min)      |
| `RATE_LIMIT_MAX`       | `200`                   | Max requests per IP per window on `/api`        |
| `JWT_ACCESS_SECRET`    | `dev-access-secret`     | Secret used to sign access tokens               |
| `JWT_REFRESH_SECRET`   | `dev-refresh-secret`    | Secret used to sign refresh tokens              |
| `JWT_ACCESS_TTL`       | `900`                   | Access token lifetime in seconds (15 min)       |
| `JWT_REFRESH_TTL`      | `604800`                | Refresh token lifetime in seconds (7 days)      |

## Scripts

| Script                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `npm run dev`             | Start the server with tsx watch (hot reload)             |
| `npm run build`           | Compile TypeScript to `dist/`                            |
| `npm start`               | Run the compiled server (`node dist/server.js`)          |
| `npm run typecheck`       | Type-check with `tsc --noEmit`                           |
| `npm run lint`            | Run ESLint                                               |
| `npm run lint:fix`        | Run ESLint with autofix                                  |
| `npm run format`          | Format all files with Prettier                           |
| `npm run format:check`    | Check formatting with Prettier                           |
| `npm test`                | Run the full test suite (vitest)                         |
| `npm run test:watch`      | Run tests in watch mode                                  |
| `npm run test:e2e`        | Run the end-to-end suite (spins up backend + storefront) |
| `npm run prisma:generate` | Regenerate the Prisma client                             |
| `npm run db:migrate`      | Apply Prisma migrations to the dev database              |
| `npm run db:deploy`       | Apply migrations without creating new ones (for prod)    |
| `npm run db:seed`         | Seed the catalog (resets carts/orders/catalog)           |
| `npm run db:studio`       | Open Prisma Studio                                       |

## Auth

Authentication uses two token types:

- **Access token** — a short-lived JWT (`JWT_ACCESS_TTL`, default 15 min) returned as JSON in the response body. Send it as `Authorization: Bearer <token>`.
- **Refresh token** — a longer-lived JWT (`JWT_REFRESH_TTL`, default 7 days) stored as an `HttpOnly`, `SameSite=Lax` cookie scoped to `Path=/api/auth`. The raw token is never sent as JSON; only a SHA-256 hash is persisted in the `RefreshToken` table.

Endpoints (mounted at `/api/auth`):

| Method | Path        | Access         | Description                                             |
| ------ | ----------- | -------------- | ------------------------------------------------------- |
| POST   | `/register` | public         | Create a user; returns `{ user, accessToken }` + cookie |
| POST   | `/login`    | public         | Authenticate; returns `{ user, accessToken }` + cookie  |
| POST   | `/refresh`  | refresh cookie | Rotates the refresh token and issues a new access token |
| POST   | `/logout`   | refresh cookie | Revokes the refresh token and clears the cookie         |
| GET    | `/me`       | access token   | Returns the current user                                |

Roles are `CUSTOMER` (default) and `ADMIN`. Protect a route with the `authenticate()` middleware and enforce roles with `authorize('ADMIN')`.

Authorization on order routes:

| Method | Path                             | Access                              |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | `/api/orders`                    | any authenticated user (own orders) |
| POST   | `/api/orders`                    | any authenticated user              |
| GET    | `/api/orders/:orderId`           | owner or `ADMIN`                    |
| GET    | `/api/orders/:orderId/audit-log` | owner or `ADMIN`                    |
| PATCH  | `/api/orders/:orderId/status`    | `ADMIN` only                        |

Catalog, search, and cart browsing endpoints remain public.

### Guest carts & merging on login

- `POST /api/carts` creates an anonymous cart; `GET /api/carts/:cartId` reads it and `POST/PATCH/DELETE /api/carts/:cartId/items[...]` mutate it (all public).
- `POST /api/carts/:cartId/merge` (**authenticated**) adopts the guest cart as the current user's cart when they have none, or replays the guest items into their existing cart (combining quantities, capped at stock) and deletes the guest cart. The storefront calls this automatically after login/registration so the anonymous cart survives sign-in.

## Audit Trail

Every auditable action writes a row to the `AuditLog` table. Rows are never updated or deleted by the application. Each row captures:

- `entityType` / `entityId` — the affected resource (e.g. `Order`, `Cart`, `User`) and its id
- `action` — e.g. `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `CART_CREATED`, `CART_ITEM_ADDED`, `CART_ITEM_UPDATED`, `CART_ITEM_REMOVED`, `CART_CLEARED`, `ORDER_CREATED`, `ORDER_STATUS_CHANGED`
- `actorType` / `actorId` — `USER` (the authenticated user's id), `GUEST` (the cart id), or `SYSTEM` (null)
- `ipAddress`, `userAgent` — request context captured by the `audit()` middleware
- `metadata` — action-specific JSON, e.g. `{ "from": "pending", "to": "paid" }` for status changes

Audit writes are fire-and-forget-safe: a failure is logged and swallowed and never fails or blocks the parent request.

Query endpoints:

| Method | Path                             | Access        | Filters                                |
| ------ | -------------------------------- | ------------- | -------------------------------------- |
| GET    | `/api/audit-log`                 | `ADMIN`       | `entityType`, `entityId`, `from`, `to` |
| GET    | `/api/orders/:orderId/audit-log` | owner/`ADMIN` | scoped to that order                   |

## Database & migrations

Prisma manages the SQLite schema. The datasource URL lives in `prisma.config.ts` (read from `DATABASE_URL`).

```bash
# After changing prisma/schema.prisma
npm run db:migrate          # creates + applies a new migration

# Apply existing migrations (CI / production)
npm run db:deploy

# Reset and re-seed the dev database
npm run db:migrate -- --reset
npm run db:seed
```

The seed script (`src/data/seed.ts`) is idempotent: it clears orders, carts, and the catalog, then inserts 3 categories and 16 products (some with variants).

## Testing

Unit tests cover the search, cart, auth, jwt, password, and audit services; integration tests exercise the auth/order/audit HTTP routes against a dedicated SQLite database (`test.db`, created by `prisma migrate deploy` and configured via `vitest.config.mjs`).

```bash
npm test          # one-off run
npm run test:watch
```

### End-to-end tests

`npm run test:e2e` starts a real API server against a dedicated SQLite database (`e2e.db`), boots the storefront dev server, and drives the full customer journey over HTTP: register → login → browse → search → add to cart as a guest → merge the cart on login → checkout → view the order in history → (as `ADMIN`) read the order's audit log and update its status → (as `CUSTOMER`) get `403` on the admin-only status update. It then verifies the recorded audit rows and that the storefront pages render live backend data.

```bash
npm run test:e2e
```

The storefront package exposes the same entry point (`npm --prefix ../backend run test:e2e`).

## API documentation

An interactive **Swagger UI** is served at:

```
GET /api/docs
```

Open it in a browser to browse and execute every endpoint without needing Postman. It renders the OpenAPI 3.0 document served at:

```
GET /api/openapi.json
```

The spec describes every endpoint, request/response schemas, and the error shape. Error responses follow a consistent envelope:

```json
{
  "error": {
    "message": "Product not found",
    "requestId": "3b0e0c9e-...",
    "details": []
  }
}
```

Every response includes an `X-Request-Id` header, echoed in structured logs for correlating requests.

## Running with Docker

A `Dockerfile` and `docker-compose.yml` are included:

```bash
docker compose up --build
```

This builds the image, runs `prisma migrate deploy` on startup, and serves the API on port `4000`. The SQLite database is persisted in the `db-data` volume.

## Project structure

```
src/
  app.ts                  # Express app assembly (helmet, cors, logging, audit, rate limit, routes)
  server.ts               # Entry point
  config/                 # env, prisma client, pino logger
  routes/                 # Express routers (health, catalog, cart, order, auth, audit-log, openapi)
  controllers/            # HTTP handlers
  services/               # Business logic (catalog, search, cart, order, auth, audit)
  repositories/           # Prisma data access + row -> domain mapping
  models/                 # Domain TypeScript interfaces
  schemas/                # Zod validation schemas
  middleware/             # validate, authenticate, authorize, audit, errorHandler, logging, rateLimit
  utils/                  # api-error, api-response, async-handler, jwt, password, money
  data/                   # seed script
prisma/
  schema.prisma           # Prisma schema
  migrations/             # SQL migrations
openapi.json              # OpenAPI 3.0 specification
```
