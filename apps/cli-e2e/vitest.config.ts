import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, '../..'),
  cacheDir: 'node_modules/.vite/apps/cli-e2e',
  test: {
    name: '@overture/cli-e2e',
    globals: true,
    environment: 'node',
    include: ['apps/cli-e2e/src/**/*.{test,spec}.ts'],
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 30000,
    reporters: ['default'],
    passWithNoTests: true,
  },
});
