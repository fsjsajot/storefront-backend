import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 240_000,
    env: {
      DATABASE_URL: 'file:./e2e.db',
    },
  },
});
