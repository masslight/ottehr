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
    // modest during integration tests (matches the prior single-config behavior). The CI scripts
    // override this per project via --maxWorkers: the integration suite is I/O-bound (its wall time
    // is FHIR round-trips, and with ~2 tests per file behind a shared beforeAll graph, files in
    // flight are the only concurrency axis), so CI raises its cap — but that only pays off when the
    // CPU-bound co-suites are worker-capped too; uncapped, the extra forks just thrash the runner
    // (measured: 10 workers ≈ 6 workers under oversubscription, plus co-suite timeouts).
    maxWorkers: 6,
    minWorkers: 1,
    // Root-only, applies to every forked test worker (unit and integration). The CI job's
    // NODE_OPTIONS sets an 8GB heap allowance, which every fork inherits; with that allowance V8
    // feels no GC pressure and long-lived workers balloon. Under --no-isolate on a 16GB standard
    // runner that got the pool OOM-killed by the kernel (silently: both attempts aborted at the
    // same elapsed time with ThreadTermination and no error from the killed worker). A 1GB cap
    // forces GC discipline per worker — one test file's module graph fits comfortably — and a
    // worker that truly exceeds it dies with a loud V8 heap error that names itself instead of a
    // silent SIGKILL.
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=1024'],
      },
    },
    server: {
      deps: {
        inline: [/@sentry/, /utils/],
      },
    },
    coverage: {
      provider: 'v8',
      // AST-aware remapping (vitest 3.2+) replaces the much slower source-map-based v8 report
      // remapping — measured as part of the integration suite's large non-test overhead share.
      experimentalAstAwareRemapping: true,
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
          // pending-network-tracker is last so it wraps the guard and sees every call: it reports
          // requests still in flight when a file ends (the --no-isolate blocker) to
          // test-results/pending-network.jsonl.
          setupFiles: [
            '../test-utils/lib/no-network.setup.ts',
            './vitest.setup.ts',
            './test/helpers/pending-network-tracker.setup.ts',
          ],
        },
      },
    ],
  },
});
