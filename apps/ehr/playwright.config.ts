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
  // The runner has 8 cores. Workers spend most of their time waiting on the local zambda server and
  // the dev server rather than burning CPU — the perf reporter puts per-worker utilization around
  // 67-70% — so the extra two workers fill idle time rather than contend for cores.
  workers: process.env.CI ? 8 : undefined,
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
});
