import { expect, test } from '@playwright/test';
import { login } from 'test-utils';

// This test creates a fresh user.json if user is not authenticated for E2E tests.
// It runs before the main test suite via run-e2e.ts for local and via github actions for CI.
test('Should log in and generate fresh user.json', async ({ page }) => {
  test.setTimeout(480_000); // ~9 min; for sms 24 attempts * 15 seconds = 6 minutes, + 45 seconds for setting local storage in login function + ~2 min for awaits

  console.log('Starting login test to generate fresh user.json...');

  // Always start fresh - go to home and initiate login flow
  await page.goto('/');
  await page.getByTestId('loading-button').click({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Past Visits' }).click({ timeout: 20_000 });

  // Perform login - this will generate user.json via storageState()
  await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);

  // Verify we're authenticated
  await expect(page.locator('[data-testid="header-for-authenticated-user"]')).toBeVisible({
    timeout: 10_000,
  });

  console.log('Login test completed - fresh user.json generated');
});
