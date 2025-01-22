import { test } from '@playwright/test';
import { login } from 'test-utils';

test('Should log in', async ({ context, browser }) => {
  let successLogin = false;
  let attemptNumber = 0;
  const maxAttempts = 10;

  while (!successLogin && attemptNumber < maxAttempts) {
    try {
      const context = await browser.newContext({
        storageState: undefined,
      });
      const page = await context.newPage();
      await context.clearCookies();
      await context.clearPermissions();

      await page.goto('/');
      await page.getByRole('button', { name: 'Continue' }).click();
      await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);
      successLogin = true;
    } catch (error) {
      attemptNumber++;
      await context.close();
      console.log(`Attempt ${attemptNumber} failed, retrying...`);
    }
  }

  if (!successLogin) {
    throw new Error(`Failed after ${maxAttempts} attempts`);
  }
});
