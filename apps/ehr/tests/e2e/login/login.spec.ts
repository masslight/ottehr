import { expect, Page, test } from '@playwright/test';
import { checkIfEnvAllowed } from '../../e2e-utils/check-env';

// Playwright puts the filled value into the error's call log, so a failed fill must not surface it.
async function fillCredential(page: Page, selector: string, value: string): Promise<void> {
  try {
    await page.fill(selector, value);
  } catch {
    throw new Error(`Could not fill ${selector}`);
  }
}

test('Should log in', async ({ page, context, browser }) => {
  checkIfEnvAllowed();

  context = await browser.newContext({
    storageState: undefined,
  });
  page = await context.newPage();
  await context.clearCookies();
  await context.clearPermissions();

  await page.goto('/');
  await fillCredential(page, '#username', process.env.TEXT_USERNAME!);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(100);
  await fillCredential(page, '#password', process.env.TEXT_PASSWORD!);
  await page.click('button[type="submit"]');

  // Check if authorization page appears and accept if it does. Actual for first login.
  try {
    const authorizeHeader = await page.waitForSelector('text=Authorize App', { timeout: 3000 });
    if (authorizeHeader) {
      await page.click('button:has-text("Accept")');
    }
  } catch {
    console.log('No authorization page detected, continuing with test');
  }

  console.log('Waiting for /visits or ZapEHR modal...');

  const result = await Promise.race([
    page.waitForURL((url) => url.pathname === '/visits', { timeout: 35000 }).then(() => 'visits'),
    page
      .getByText(/continue with zapehr/i)
      .waitFor({ timeout: 35000 })
      .then(() => 'modal'),
  ]);

  console.log(`Race resolved with: ${result}`);

  if (result === 'modal') {
    console.log('ZapEHR modal detected, clicking...');
    await page.getByText(/continue with zapehr/i).click();
    console.log('Waiting for /visits after modal...');
    await page.waitForURL((url) => url.pathname === '/visits');
  }

  console.log('Reached /visits');

  // save login context
  await context.storageState({ path: './playwright/user.json' });

  await expect(page.getByTestId('PersonIcon')).toBeVisible({ timeout: 30_000 });
});
