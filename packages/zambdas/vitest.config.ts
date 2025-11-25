import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    silent: true,
    testTimeout: 20000,
    exclude: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
