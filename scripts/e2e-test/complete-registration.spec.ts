import { expect, test } from '@playwright/test';

export const checkIfEnvAllowed = () => {
  const env = process.env.ENV;

  console.log('used ENV: ', env);

  // temporary check, later we can remove this check if we want to allow tests on production
  if (env === 'demo') {
    throw Error('⚠️ Only non production envs allowed');
  }
};

test('Should complete registration', async ({ page, context, browser }) => {
  checkIfEnvAllowed();

  context = await browser.newContext({
    storageState: undefined,
  });
  page = await context.newPage();
  await context.clearCookies();
  await context.clearPermissions();

  await page.goto(`${process.env.E2E_TEST_USER_INVITE_URL}`);
  await page.fill('#password-reset', process.env.E2E_TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.fill('#re-enter-password', process.env.E2E_TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Password Changed!', { timeout: 3000 });
});
