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
    // no-network.setup.ts blocks real network egress for non-integration tests;
    // integration tests (test/integration/**) are exempt by path and keep hitting
    // the in-process test server started by globalSetup.
    setupFiles: ['../test-utils/lib/no-network.setup.ts', './vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@sentry/, /utils/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'json'],
      reportsDirectory: './coverage/integration',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts', 'src/scripts/**', 'src/local-server/**'],
    },
  },
});
