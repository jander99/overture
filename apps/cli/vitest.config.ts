import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/cli',

  resolve: {
    alias: {
      chalk: path.resolve(__dirname, 'src/__mocks__/chalk.ts'),
    },
  },

  test: {
    name: '@overture/cli',
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/main.ts'],
    },
  },
});
