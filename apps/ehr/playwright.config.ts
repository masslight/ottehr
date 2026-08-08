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
    ['../../packages/test-utils/lib/e2e/perf-reporter.ts'],
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
  // Worker count is measured, and 8 is the knee. Against the Vite dev server 8 workers made every
  // test slower; against the production build they cost nothing per test (total test time +0.4%) and
  // took 17% off wall clock, which is what this is set to. 12 overshoots: total test time rose 23.6%
  // for only 8% off wall clock, buying parallelism by making every test slower and eating timeout
  // headroom. Worker utilization at 12 spread to 33-74%, so the ceiling is the suite's own structure
  // — ~31 files and several serial groups — rather than the runner. More workers need more
  // independent work, not more cores.
  workers: process.env.CI ? 8 : undefined,
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
});
