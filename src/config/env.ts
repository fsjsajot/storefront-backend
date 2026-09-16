import dotenv from 'dotenv';

dotenv.config();

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  return Number.isFinite(port) && port > 0 ? port : 3000;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  port: parsePort(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  rateLimitWindowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 200),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  jwtAccessTtl: parsePositiveInt(process.env.JWT_ACCESS_TTL, 15 * 60),
  jwtRefreshTtl: parsePositiveInt(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60),
};

export const isProduction = env.nodeEnv === 'production';
