import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();
/**
 * See https://playwright.dev/docs/test-configuration.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: ['**/component/**', '**/unit/**'],
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
    actionTimeout: 25000,
    navigationTimeout: 30000,
  },
  timeout: 120000,
  expect: {
    timeout: 30000,
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
      // Keeps login out of the main specs run.
      name: 'login',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      testMatch: /.*login\/login\.spec\.ts/,
    },
    {
      name: 'paperwork-setup',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      testMatch: /.*setup\.spec\.ts/,
      testIgnore: [/.*login\/login\.spec\.ts/, /.*setup-validation\.spec\.ts/],
      timeout: 240000,
    },
    {
      // Validates that ALL paperwork-setup tests passed (checks marker file)
      name: 'setup-validation',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      testMatch: /.*setup-validation\.spec\.ts/,
      dependencies: ['paperwork-setup'],
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/user.json',
      },
      // chromium runs ONLY if setup-validation passes (which means ALL setup tests passed)
      dependencies: ['setup-validation'],
      testIgnore: [/.*login\/login\.spec\.ts/, /.*setup\.spec\.ts/, /.*setup-validation\.spec\.ts/],
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  /* webServer: {
    command: 'npm run start-all',
    timeout: 10000,
    port: 3002,
    // reuseExistingServer: !process.env.CI,
  },*/
});
