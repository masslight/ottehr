import { expect, test } from '@playwright/test';
import { login } from 'test-utils';

test('Should log in if not authorized', async ({ context, page }) => {
  test.setTimeout(480_000); // ~9 min; for sms 24 attempts * 15 seconds = 6 minutes, + 45 seconds for setting local storage in login function + ~2 min for awaits

  try {
    await page.goto('/home');

    try {
      await page.getByRole('button', { name: 'In-Person Check-In' }).click();
      await page.getByTestId('loading-button').click({ timeout: 20_000 });
      await expect(page.getByTestId('flow-page-title')).toBeVisible({
        timeout: 18_000,
      });
      console.log('User is already logged in');
    } catch {
      console.log('User is not logged in, proceeding with coordinated login...');
      await context.clearCookies();
      await context.clearPermissions();
      await page.goto('/');
      await page.getByTestId('loading-button').click({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Past Visits' }).click({ timeout: 20_000 });
      await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
    }
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
});
