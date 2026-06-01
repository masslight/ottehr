import { expect, test } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { ENV_LOCATION_NAME } from '../../../e2e-utils/resource/constants';
import { openVisitsPage } from '../../page/VisitsPage';

// Regression coverage for OTR-2634. Component tests in tests/component/ exercise
// AppointmentTabs and AppointmentsFilters in isolation; this spec exercises the
// real interaction between the two siblings — which is where the original bug
// (and the most likely future regression) lives.

const SELECTED_TAB_STORAGE_KEY = 'selectedAppointmentTab';

test.describe('Tracking board ?tab= URL state', () => {
  test('writes ?tab= on first load when none is in the URL', async ({ page }) => {
    await openVisitsPage(page);

    await expect(page).toHaveURL(/[?&]tab=in-office\b/);
    await expect(page.getByTestId(dataTestIds.dashboard.inOfficeTab)).toHaveAttribute('aria-selected', 'true');
  });

  test('URL ?tab= takes precedence over a conflicting localStorage value', async ({ page }) => {
    // Seed a conflicting tab in localStorage before the app boots. If the
    // precedence ladder ever flips, this test fails.
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      [SELECTED_TAB_STORAGE_KEY, 'prebooked']
    );

    await page.goto('/visits?tab=completed');

    await expect(page).toHaveURL(/[?&]tab=completed\b/);
    await expect(page.getByTestId(dataTestIds.dashboard.dischargedTab)).toHaveAttribute('aria-selected', 'true');
  });

  test('?tab= survives a filter change on a non-default tab', async ({ page }) => {
    await page.goto('/visits?tab=completed');
    await expect(page.getByTestId(dataTestIds.dashboard.dischargedTab)).toHaveAttribute('aria-selected', 'true');

    // Interacting with AppointmentsFilters re-fires the form-subscribe callback
    // that writes back to the URL — the very write that was clobbering ?tab=
    // before the fix.
    await page.getByTestId(dataTestIds.dashboard.locationSelect).click();
    await page.locator(`li[role="option"]:has-text("${ENV_LOCATION_NAME}")`).first().click();
    // Close the dropdown so the URL settles.
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/[?&]tab=completed\b/);
    await expect(page).toHaveURL(/[?&]location=/);
    await expect(page.getByTestId(dataTestIds.dashboard.dischargedTab)).toHaveAttribute('aria-selected', 'true');
  });
});
