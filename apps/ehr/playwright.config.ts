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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['html'], ['list'], ['junit', { outputFile: 'test-results/results.xml' }]],
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
    timeout: 25000,
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
  workers: process.env.CI ? 6 : undefined,
  testIgnore: ['tests/e2e/specs/employees.spec.ts'],
  globalSetup: './tests/global-setup/index.ts',
  globalTeardown: './tests/global-teardown/index.ts',
});
