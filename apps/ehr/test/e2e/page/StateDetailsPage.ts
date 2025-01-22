import { expect, Page } from '@playwright/test';

export async function expectStateDetailsPage(state: string, page: Page): Promise<void> {
  await page.waitForURL(`/telemed-admin/states/` + state);
  await expect(page.locator('h3').getByText(state + ' - Telemed')).toBeVisible();
}
