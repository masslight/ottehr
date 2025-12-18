import { expect, test } from '@playwright/test';
import { BOOKING_CONFIG, shouldShowServiceCategorySelectionPage } from 'utils';

test.describe.parallel('In-Person Check-in Service Category Selection', () => {
  const categories = BOOKING_CONFIG.serviceCategories || [];
  const testCategory = categories[0];

  test.skip(!testCategory, 'No service categories configured, skipping tests');

  if (!testCategory) return;

  test('Should allow selecting service category for In-Person Check-In', async ({ page }) => {
    if (!shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'walk-in' })) {
      test.skip();
      return;
    }

    await page.goto('/home');
    await page.getByRole('button', { name: 'In-Person Check-In' }).click();

    await expect(page).toHaveURL(/\/walkin\/location\/.*\/select-service-category/);
    await expect(page.getByText(testCategory.display)).toBeVisible();

    await page.getByText(testCategory.display).click();

    await expect(page).toHaveURL(new RegExp(`/walkin/location/.*\\?serviceCategory=${testCategory.code}`));

    await expect(page.getByRole('heading', { name: 'Welcome to Ottehr' })).toBeVisible();
  });
});
