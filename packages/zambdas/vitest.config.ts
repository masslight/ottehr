import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    testTimeout: 180000, // 3 minutes
    hookTimeout: 30000, // 30 seconds
    teardownTimeout: 30000, // 30 seconds
    // Integration tests run in parallel against a shared live backend. A few
    // multi-step booking tests occasionally hit transient backend contention
    // under that load (they pass in isolation); retry absorbs those transient
    // failures. Deterministic races are fixed at the source, not retried.
    retry: 2,
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
