import { expect, Page } from '@playwright/test';

export const clickContinue = async (page: Page, awaitNavigation = true): Promise<unknown> => {
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 10000 });
  const currentPath = new URL(page.url()).pathname;
  if (awaitNavigation) {
    return await Promise.all([
      page.waitForURL((url) => url.pathname !== currentPath),
      page.getByRole('button', { name: 'Continue' }).click(),
    ]);
  } else {
    return await page.getByRole('button', { name: 'Continue' }).click();
  }
};
