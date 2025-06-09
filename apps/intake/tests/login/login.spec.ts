import { expect, test } from '@playwright/test';
import { login } from 'test-utils';

test('Should log in if not authorized', async ({ context, page }) => {
  try {
    await page.goto('/home');

    try {
      await page.getByRole('button', { name: 'In-Person Check-In' }).click();
      await page.getByTestId('loading-button').click({ timeout: 20000 });
      // select patient page may be shown if user is not logged in for a several milliseconds, so recheck to ensure that user is logged in
      await page.waitForTimeout(3000);
      await expect(page.getByTestId('flow-page-title')).toBeVisible({
        timeout: 15000,
      });

      console.log('User is already logged in');
      return;
    } catch {
      console.log('User is not logged in, proceeding with login...');
      let successLogin = false;
      let attemptNumber = 0;
      const maxAttempts = 2;

      while (!successLogin && attemptNumber < maxAttempts) {
        try {
          await context.clearCookies();
          await context.clearPermissions();
          await page.goto('/');
          await page.getByTestId('loading-button').click({ timeout: 20000 });
          await page.getByRole('button', { name: 'Past Visits' }).click();
          await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
          successLogin = true;
        } catch (error) {
          console.error(error);
          attemptNumber++;
          console.log(`Attempt ${attemptNumber} failed, retrying...`);
          if (attemptNumber === maxAttempts) {
            throw new Error(`Failed after ${maxAttempts} attempts`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
});
