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
  // Re-testing 8 after the earlier measurement was invalidated. Eight workers previously made every
  // test slower — total test time ~1940s to ~2520s with wall clock flat — but that contention was
  // mostly the Vite dev server transforming modules for six browsers at once. The job now serves a
  // static production build, so per-request cost is far lower and the earlier result no longer
  // applies. There is headroom on paper: the perfect-packing floor is ~172s against a ~284s wall
  // clock. The risk is the other direction now — tests are ~2x faster, so per-worker startup and
  // spec imports are a bigger share, and two more workers add two more of those.
  workers: process.env.CI ? 8 : undefined,
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
});
