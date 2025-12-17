import { expect, test } from '@playwright/test';
import { BOOKING_CONFIG, shouldShowServiceCategorySelectionPage } from 'utils';

test.describe.parallel('Telemed Check-in Service Category Selection', () => {
  const categories = BOOKING_CONFIG.serviceCategories || [];
  const testCategory = categories[0];

  test.skip(!testCategory, 'No service categories configured, skipping tests');

  if (!testCategory) return;

  test('Should allow selecting service category for Virtual Visit Check-In', async ({ page }) => {
    if (!shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'walk-in' })) {
      test.skip();
      return;
    }

    await page.goto('/home');
    await page.getByRole('button', { name: 'Virtual Visit Check-In' }).click();

    await expect(page).toHaveURL(/\/start-virtual\/select-service-category/);
    await expect(page.getByText(testCategory.display)).toBeVisible();

    await page.getByText(testCategory.display).click();

    await expect(page).toHaveURL(new RegExp(`/start-virtual\\?serviceCategory=${testCategory.code}`));
    await expect(page.getByRole('heading', { name: 'Request a Virtual Visit', level: 2 })).toBeVisible();
  });
});
