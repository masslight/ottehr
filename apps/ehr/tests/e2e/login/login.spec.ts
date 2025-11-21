import { expect, test } from '@playwright/test';
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
  await page.waitForTimeout(100);
  await page.fill('#password', process.env.TEXT_PASSWORD!);
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

  await page.waitForURL('/visits');

  // save login context
  await context.storageState({ path: './playwright/user.json' });

  // Try to handle additional auth modal if it appears
  try {
    // Look for the ZapEHR button with case-insensitive text matching
    const zapehrButton = page.getByText(/continue with zapehr/i);
    await zapehrButton.waitFor({ timeout: 5000 });
    await zapehrButton.click();
    console.log('Auth modal detected, logged in through ZapEHR');
  } catch {
    console.log('Auth modal not detected, continuing');
  }

  await expect(page.getByTestId('PersonIcon')).toBeVisible({ timeout: 30_000 });
});
