import { expect, test } from '@playwright/test';
// @ts-expect-error import from js
import { checkIfEnvAllowed } from '../../e2e-utils/check-env';

test('Should log in', async ({ page, context, browser }) => {
  checkIfEnvAllowed();

  context = await browser.newContext({
    storageState: undefined,
  });
  page = await context.newPage();
  await context.clearCookies();
  await context.clearPermissions();

  await page.goto('/');
  await page.fill('#username', process.env.TEXT_USERNAME!);
  await page.click('button[type="submit"]');
  await page.fill('#password', process.env.TEXT_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/visits');

  // save login context
  await context.storageState({ path: './playwright/user.json' });

  await expect(page.getByTestId('PersonIcon')).toBeVisible();
});
