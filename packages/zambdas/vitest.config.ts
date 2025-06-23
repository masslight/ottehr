import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: true,
    silent: true,
    testTimeout: 20000,
    exclude: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
