import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 * require('dotenv').config();
 *
 * See https://playwright.dev/docs/test-configuration.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: ['**/component/**', '**/unit/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['./tests/e2e-utils/perf-reporter.ts'],
  ],
  use: {
    baseURL: process.env.WEBSITE_URL,
    trace: process.env.CI ? 'on-first-retry' : 'on',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 35_000,
    navigationTimeout: 35_000,
  },
  timeout: 120_000,
  expect: {
    timeout: 35_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
    },
  ],
  retries: process.env.CI ? 2 : 0,
  outputDir: 'test-results/',
  // Worker count is measured, and the measurement moved once the app stopped being served by a Vite
  // dev server. With the dev server, 8 workers made every test slower — total test time ~1940s to
  // ~2520s with wall clock flat. Against a static production build, 8 workers cost nothing per test
  // (total test time +0.4%) and took 17% off wall clock, so the contention was the dev server rather
  // than the runner's cores. 12 pushes past the core count deliberately: these tests spend most of
  // their time waiting on the zambda server and FHIR rather than burning CPU. The thing to watch is
  // total test time — if it climbs, workers are contending again, and the next suspect is the
  // single-process zambda emulator.
  workers: process.env.CI ? 12 : undefined,
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
});
