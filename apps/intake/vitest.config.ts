import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/*.spec.ts'],
  },
});
