import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: false,
    testTimeout: 20000,
    exclude: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
