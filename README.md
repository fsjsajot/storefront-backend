# Ecommerce Backend

A standalone REST API server for the ecommerce project. Built with Node.js, TypeScript, and Express, using Prisma with SQLite for persistence and Zod for validation.

## Features

- **Catalog** — categories and products with variants
- **Search** — full-text-ish filtering, sorting, and pagination over products
- **Carts** — anonymous, fully persisted carts with server-computed subtotal/tax/total (8.25% tax)
- **Orders** — order creation from a cart with atomic stock decrements, plus status transitions (`pending -> paid -> fulfilled`, or `cancelled`)
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

| Variable               | Default         | Description                                    |
| ---------------------- | --------------- | ---------------------------------------------- |
| `PORT`                 | `4000`          | HTTP port the server listens on                |
| `NODE_ENV`             | `development`   | `development` or `production` (sets log level) |
| `DATABASE_URL`         | `file:./dev.db` | SQLite database file (Prisma connection URL)   |
| `RATE_LIMIT_WINDOW_MS` | `900000`        | Rate-limit window in milliseconds (15 min)     |
| `RATE_LIMIT_MAX`       | `200`           | Max requests per IP per window on `/api`       |

## Scripts

| Script                    | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Start the server with tsx watch (hot reload)          |
| `npm run build`           | Compile TypeScript to `dist/`                         |
| `npm start`               | Run the compiled server (`node dist/server.js`)       |
| `npm run typecheck`       | Type-check with `tsc --noEmit`                        |
| `npm run lint`            | Run ESLint                                            |
| `npm run lint:fix`        | Run ESLint with autofix                               |
| `npm run format`          | Format all files with Prettier                        |
| `npm run format:check`    | Check formatting with Prettier                        |
| `npm test`                | Run the full test suite (vitest)                      |
| `npm run test:watch`      | Run tests in watch mode                               |
| `npm run prisma:generate` | Regenerate the Prisma client                          |
| `npm run db:migrate`      | Apply Prisma migrations to the dev database           |
| `npm run db:deploy`       | Apply migrations without creating new ones (for prod) |
| `npm run db:seed`         | Seed the catalog (resets carts/orders/catalog)        |
| `npm run db:studio`       | Open Prisma Studio                                    |

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

Unit tests cover the search and cart services; integration tests exercise the order service against a dedicated SQLite database (`test.db`, created by `prisma migrate deploy` and configured via `vitest.config.mjs`).

```bash
npm test          # one-off run
npm run test:watch
```

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
  app.ts                  # Express app assembly (helmet, cors, logging, rate limit, routes)
  server.ts               # Entry point
  config/                 # env, prisma client, pino logger
  routes/                 # Express routers (health, catalog, cart, order, openapi)
  controllers/            # HTTP handlers
  services/               # Business logic (catalog, search, cart, order)
  repositories/           # Prisma data access + row -> domain mapping
  models/                 # Domain TypeScript interfaces
  schemas/                # Zod validation schemas
  middleware/             # validate, errorHandler, logging, rateLimit
  utils/                  # api-error, api-response, async-handler, money
  data/                   # seed script
prisma/
  schema.prisma           # Prisma schema
  migrations/             # SQL migrations
openapi.json              # OpenAPI 3.0 specification
```
