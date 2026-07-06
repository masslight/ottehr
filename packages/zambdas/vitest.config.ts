import { configDefaults, defineConfig } from 'vitest/config';

// The zambda suite is split into two vitest projects so that retry + globalSetup apply ONLY to the
// integration tests:
//   - unit:        src/** and test/** EXCEPT test/integration/**. Offline (network blocked by
//                  no-network.setup), no retry, no globalSetup. Run alone with
//                  `vitest run --project unit` — needs no Auth0 secrets or network.
//   - integration: test/integration/**. Hits the shared live backend via the server started in
//                  globalSetup; retry absorbs transient FHIR read-after-write artifacts.
//
// Previously everything shared one config (no include filter), so retry:2 silently masked
// nondeterministic UNIT failures and every `vitest run` fired live M2M provisioning + the leak-gate
// sweep — even for a unit-only run. Scoping both to the integration project fixes that.
//
// Shared options live on the root config and are inherited by each project via `extends: true`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    // Root-only in vitest 3 (not a ProjectConfig option). Generous so the integration globalSetup
    // teardown — two 5s settle waits + the leak-gate sweep across many resource types + deletes —
    // never times out.
    teardownTimeout: 60000,
    // Root-only in vitest 3. Caps concurrent workers to keep write pressure on the shared backend
    // modest during integration tests (matches the prior single-config behavior).
    maxWorkers: 6,
    minWorkers: 1,
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
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'test/integration/**'],
          testTimeout: 30000,
          // Match testTimeout — unit tests that dynamic-import their handler
          // inside beforeEach can occasionally exceed vitest's built-in 10s
          // hook default under heavy transform load across the ~450 test files.
          hookTimeout: 30000,
          // no globalSetup and no retry: unit tests must be deterministic and run offline.
          setupFiles: ['../test-utils/lib/no-network.setup.ts', './vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          testTimeout: 180000, // 3 minutes
          hookTimeout: 30000, // 30 seconds
          // Integration tests run in parallel against a shared live backend. A few multi-step booking
          // tests occasionally hit a transient FHIR search read-after-write consistency artifact under
          // heavy concurrent write load (they pass in isolation); retry absorbs those. Deterministic
          // races are fixed at the source, not retried. Scoped to this project so it never masks
          // nondeterminism in unit tests.
          retry: 2,
          globalSetup: './test/helpers/integration-global-setup.ts',
          // no-network.setup.ts blocks real network egress for non-integration tests; integration tests
          // (test/integration/**) are exempt by path and keep hitting the in-process test server.
          setupFiles: ['../test-utils/lib/no-network.setup.ts', './vitest.setup.ts'],
        },
      },
    ],
  },
});
