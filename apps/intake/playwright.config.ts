import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: ['**/component/**', '**/unit/**', '**/utils/**'],
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: process.env.CI ? true : false,
  /* Retry on CI only */
  // retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    [
      'html',
      {
        outputFolder: `playwright-report${process.env.PLAYWRIGHT_REPORT_SUFFIX || ''}`,
      },
    ],
    ['list'],
    [
      'junit',
      {
        outputFile: `test-results${process.env.PLAYWRIGHT_REPORT_SUFFIX || ''}/results.xml`,
      },
    ],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.WEBSITE_URL,
    trace: process.env.CI ? 'on-first-retry' : 'on',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 40_000,
    navigationTimeout: 40_000,
  },
  timeout: 240_000,
  expect: {
    timeout: 40_000,
  },
  retries: process.env.CI ? 2 : 0,
  outputDir: `test-results${process.env.PLAYWRIGHT_REPORT_SUFFIX || ''}/`,
  workers: process.env.CI ? 6 : undefined,
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
  /* Global timeout for entire test run - 15 minutes max for intake tests */
  globalTimeout: 15 * 60 * 1000,

  /* Configure projects for major browsers */
  projects: [
    {
      // Runs ONLY when explicitly invoked (e.g. via run-e2e "login" stage).
      // Generates fresh user.json for authentication.
      name: 'login',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      testMatch: /.*login\/login\.spec\.ts/,
    },
    {
      // E2E tests for booking flows, paperwork, and extended scenarios
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      testDir: './tests/e2e',
      testMatch: /.*\.spec\.ts/,
      timeout: 360_000, // 6 minutes - extended scenarios need more time
    },
  ],

  /* Run your local dev server before starting the tests */
  /* webServer: {
    command: 'npm run start-all',
    timeout: 10000,
    port: 3002,
    // reuseExistingServer: !process.env.CI,
  },*/
});
