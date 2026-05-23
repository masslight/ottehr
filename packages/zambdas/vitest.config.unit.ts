import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    testTimeout: 30000,
    include: ['test/unit/**/*.test.ts', 'test/rcm/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@sentry/, /utils/],
      },
    },
  },
});
