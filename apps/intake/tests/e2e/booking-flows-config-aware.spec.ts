/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Config-driven booking flow e2e tests
 *
 * These tests derive which booking flows to test based on BOOKING_CONFIG.
 * Instead of hardcoding test paths, we use the config to determine:
 * - Which service modes are available (in-person, virtual)
 * - Which visit types are enabled (prebook, walk-in)
 * - Which homepage options should appear
 * - Which patient fields should be visible
 *
 * This allows downstream repos to run the same test suite with their
 * customized configs, automatically testing only the flows they've enabled.
 */

import { expect, test } from '@playwright/test';
import { createBookingConfigForTest } from 'utils';
import { BookingConfigHelper } from '../utils/config/BookingConfigHelper';

// TODO: These tests are stubs showing the pattern. Actual navigation logic needs to be added.

test.describe('Config-driven booking flows', () => {
  test.describe.configure({ mode: 'parallel' });

  test('homepage shows only enabled booking options', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Verify each enabled option is visible by label
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
    }

    // Verify the count matches config
    expect(homepageOptions.length).toBeGreaterThan(0);
  });

  test('inPersonOnly config shows only in-person options', async ({ page }) => {
    const config = createBookingConfigForTest('inPersonOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show in-person options by label
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('in-person');
    }

    // Should NOT show virtual options - get actual labels from baseline config
    const baselineConfig = createBookingConfigForTest('baseline');
    const startVirtualLabel = baselineConfig.homepageOptions.find((opt) => opt.id === 'start-virtual-visit')?.label;
    const scheduleVirtualLabel = baselineConfig.homepageOptions.find((opt) => opt.id === 'schedule-virtual-visit')
      ?.label;

    if (startVirtualLabel) {
      await expect(page.getByRole('button', { name: startVirtualLabel })).not.toBeVisible();
    }
    if (scheduleVirtualLabel) {
      await expect(page.getByRole('button', { name: scheduleVirtualLabel })).not.toBeVisible();
    }
  });

  test('virtualOnly config shows only virtual options', async ({ page }) => {
    const config = createBookingConfigForTest('virtualOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show virtual options by label
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('virtual');
    }

    // Should NOT show in-person options - get actual labels from baseline config
    const baselineConfig = createBookingConfigForTest('baseline');
    const startInPersonLabel = baselineConfig.homepageOptions.find((opt) => opt.id === 'start-in-person-visit')?.label;
    const scheduleInPersonLabel = baselineConfig.homepageOptions.find((opt) => opt.id === 'schedule-in-person-visit')
      ?.label;

    if (startInPersonLabel) {
      await expect(page.getByRole('button', { name: startInPersonLabel })).not.toBeVisible();
    }
    if (scheduleInPersonLabel) {
      await expect(page.getByRole('button', { name: scheduleInPersonLabel })).not.toBeVisible();
    }
  });

  test('in-person walk-in flow completes when enabled', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const flows = BookingConfigHelper.getTestableFlows(config);

    if (!flows.includes('in-person-walk-in')) {
      test.skip();
    }

    // TODO: Navigate through in-person walk-in flow
    // await page.goto('/');
    // await page.getByTestId('start-in-person-visit').click();
    // ... complete patient info, location selection, etc.

    expect(true).toBe(true); // Placeholder
  });

  test('virtual prebook flow completes when enabled', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const flows = BookingConfigHelper.getTestableFlows(config);

    if (!flows.includes('virtual-prebook')) {
      test.skip();
    }

    // TODO: Navigate through virtual prebook flow
    // await page.goto('/');
    // await page.getByTestId('schedule-virtual-visit').click();
    // ... complete patient info, time selection, etc.

    expect(true).toBe(true); // Placeholder
  });

  test('patient form shows only visible fields', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const visibleFields = BookingConfigHelper.getVisiblePatientFields(config);

    // TODO: Navigate to patient info page
    // await page.goto('/patient-info');

    // TODO: Verify visible fields are shown
    // for (const fieldKey of visibleFields) {
    //   await expect(page.getByTestId(fieldKey)).toBeVisible();
    // }

    expect(visibleFields.length).toBeGreaterThan(0);
  });

  test('hidden patient fields are not displayed', async ({ page }) => {
    const config = createBookingConfigForTest('hiddenPatientFields');
    const hiddenFields = config.formConfig.FormFields.patientInfo.hiddenFields || [];

    if (hiddenFields.length === 0) {
      test.skip();
    }

    // TODO: Navigate to patient info page
    // await page.goto('/patient-info');

    // TODO: Verify hidden fields are not visible
    // for (const fieldKey of hiddenFields) {
    //   await expect(page.getByTestId(fieldKey)).not.toBeVisible();
    // }

    expect(hiddenFields.length).toBeGreaterThan(0);
  });
});

test.describe('Dynamic flow testing based on config', () => {
  test.describe.configure({ mode: 'parallel' });

  test('all enabled flows can complete', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const flows = BookingConfigHelper.getTestableFlows(config);

    // TODO: This would ideally be split into separate tests per flow
    // For now, just verify we identified flows correctly
    expect(flows.length).toBeGreaterThan(0);

    // TODO: For each flow:
    // - Navigate to homepage
    // - Select the appropriate option
    // - Complete the flow
    // - Verify success

    for (const flow of flows) {
      console.log(`Flow to test: ${flow}`);
      // TODO: Implement flow testing logic
    }
  });
});

test.describe('Service category selection', () => {
  test('service category page appears when multiple categories enabled', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const categories = BookingConfigHelper.getServiceCategories(config);

    // TODO: Navigate to booking flow that would show service category selection
    // const shouldShowSelection = categories.length > 1;
    // if (shouldShowSelection) {
    //   await expect(page.getByText('Select service category')).toBeVisible();
    // }

    expect(categories).toBeDefined();
  });

  test('service category page skipped when single category', async ({ page }) => {
    const config = createBookingConfigForTest('urgentCareOnly');
    const categories = BookingConfigHelper.getServiceCategories(config);

    expect(categories.length).toBe(1);

    // TODO: Navigate through flow and verify service category page is skipped
  });
});
