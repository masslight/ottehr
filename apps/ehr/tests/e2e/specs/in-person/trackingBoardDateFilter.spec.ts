import { expect, test } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { openVisitsPage } from '../../page/VisitsPage';

// Regression coverage for OTR-3134 (part of OTR-2985): ticking "Date Range" used to swap in MUI's
// range calendar, which sizes its days differently and made the popover change dimensions. Component
// tests cannot catch that — jsdom has no layout — so the geometry is asserted in a real browser here.

test.describe('Tracking board date filter', () => {
  test('keeps the calendar dimensions when Date Range is toggled', async ({ page }) => {
    await openVisitsPage(page);

    await page.getByTestId(dataTestIds.dashboard.dateFilter).click();
    const popover = page.getByTestId(dataTestIds.dashboard.datePickerPopover);
    await expect(popover).toBeVisible();
    // Layout size, so the reading does not depend on where the popover sits or on the open animation.
    const size = (): Promise<{ width: number; height: number }> =>
      popover.evaluate((element: HTMLElement) => ({ width: element.offsetWidth, height: element.offsetHeight }));
    const singleDateSize = await size();

    const rangeCheckbox = page.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox);
    await rangeCheckbox.click();
    await expect(rangeCheckbox).toBeChecked();

    expect(await size()).toEqual(singleDateSize);
  });

  test('opens the month list from the calendar header in Date Range mode', async ({ page }) => {
    await openVisitsPage(page);

    await page.getByTestId(dataTestIds.dashboard.dateFilter).click();
    await page.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox).click();

    await page.getByRole('button', { name: /switch to/ }).click();

    await expect(page.getByRole('radio', { name: 'January' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'December' })).toBeVisible();
  });
});
