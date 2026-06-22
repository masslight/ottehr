import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: false,
    testTimeout: 30000,
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@sentry/, /utils/],
      },
    },
  },
});
