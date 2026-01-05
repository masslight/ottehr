import { expect, test } from '@playwright/test';
import { BOOKING_CONFIG, shouldShowServiceCategorySelectionPage } from 'utils';

test.describe.parallel('THP. Telemed Homepage', () => {
  test('THP-1. Should open home page and show Request a Virtual Visit button', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Virtual Visit Check-In' }).click();

    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'walk-in' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await page.getByText(firstCategory.display).click();
      }
    }

    await expect(page.getByRole('heading', { name: 'Request a Virtual Visit', level: 2 })).toBeVisible({
      timeout: 15000,
    });
  });

  // why is this in the "telemed homepage" spec?
  test('THP-2. Should open Book In-Person Visit', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Schedule an In-Person Visit' }).click();

    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'prebook' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await page.getByText(firstCategory.display).click();
      }
    }

    if (BOOKING_CONFIG.inPersonPrebookRoutingParams.some((param) => param.key === 'bookingOn') === false) {
      // if there is no bookingOn param, the location selector will be presented
      // and we need to select a location before proceeding
      const locationSelector = page.locator('#bookable-autocomplete');
      await expect(locationSelector).toBeVisible();
      await locationSelector.click();
      await page.getByRole('option', { disabled: false }).first().click();
    }

    await expect(
      page.getByRole('tablist', {
        name: 'Appointment tabs for switching between appointments slots for today and tomorrow',
      })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('THP-3. Should open Support dialog', async ({ page }) => {
    await page.goto('/home');
    await page.getByRole('button', { name: 'Support' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Need help?')).toBeVisible();
  });
});
