import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/helpers/empty.ts', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
