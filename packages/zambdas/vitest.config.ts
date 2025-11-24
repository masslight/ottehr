import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: !process.env.PLAYWRIGHT_TEST_BASE_URL, // Disable globals when Playwright is running
    environment: 'node',
    silent: true,
    testTimeout: 20000,
    exclude: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
