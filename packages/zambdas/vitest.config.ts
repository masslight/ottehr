import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    testTimeout: 180000, // 3 minutes
    hookTimeout: 30000, // 30 seconds
    teardownTimeout: 30000, // 30 seconds
    globalSetup: './test/helpers/integration-global-setup.ts',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@sentry/, /utils/],
      },
    },
  },
});
