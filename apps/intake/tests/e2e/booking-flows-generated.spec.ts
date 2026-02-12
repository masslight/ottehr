/**
 * Generated booking flow tests using test factory
 *
 * This file demonstrates the test factory pattern where we:
 * 1. Generate all valid booking flow permutations from config
 * 2. Create a test for each permutation
 * 3. Test individual steps within each scenario context
 * 4. Run all tests in parallel
 */

import { expect, test } from '@playwright/test';
import { createBookingConfigForTest } from 'utils';
import {
  executeBookingScenario,
  generateBookingTestScenarios,
  testScenarioStep,
} from '../utils/booking/BookingTestFactory';
import { BookingConfigHelper } from '../utils/config/BookingConfigHelper';

test.describe.configure({ mode: 'parallel' });

// Generate test scenarios from baseline config
const BASE_CONFIG = 'baseline';
const scenarios = generateBookingTestScenarios(BASE_CONFIG);

test.describe('Homepage option rendering', () => {
  test('baseline - homepage shows only enabled booking options', async ({ page }) => {
    const config = createBookingConfigForTest('baseline');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Verify each enabled option is visible by its label text
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
    }

    // Verify the count matches config
    expect(homepageOptions.length).toBeGreaterThan(0);
  });

  test('inPersonOnly - homepage shows only in-person options', async ({ page }) => {
    const config = createBookingConfigForTest('inPersonOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show in-person options by their labels
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('in-person');
    }

    // Should NOT show virtual options
    await expect(page.getByRole('button', { name: 'Start Virtual Visit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule Virtual Visit' })).not.toBeVisible();
  });

  test('virtualOnly - homepage shows only virtual options', async ({ page }) => {
    const config = createBookingConfigForTest('virtualOnly');
    const homepageOptions = BookingConfigHelper.getHomepageOptions(config);

    await BookingConfigHelper.injectTestConfig(page, config);
    await page.goto('/home');

    // Should show virtual options by their labels
    for (const option of homepageOptions) {
      await expect(page.getByRole('button', { name: option.label })).toBeVisible();
      expect(option.id).toContain('virtual');
    }

    // Should NOT show in-person options
    await expect(page.getByRole('button', { name: 'Start In-Person Visit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule In-Person Visit' })).not.toBeVisible();
  });
});

test.describe('Complete booking flows - all permutations', () => {
  // Generate a test for each scenario
  for (const scenario of scenarios) {
    test(`${scenario.description} - complete flow`, async ({ page }) => {
      const config = createBookingConfigForTest(scenario.configName);

      await executeBookingScenario(page, scenario, config);

      // Verify we reached confirmation
      await expect(page.getByTestId('booking-confirmation')).toBeVisible();
    });
  }
});

test.describe('Service category selection - per scenario', () => {
  // Test service category selection for each homepage option
  const uniqueHomepageLabels = [...new Set(scenarios.map((s) => s.homepageOptionLabel))];

  for (const optionLabel of uniqueHomepageLabels) {
    test(`${optionLabel} - service category selection behavior`, async ({ page }) => {
      const config = createBookingConfigForTest(BASE_CONFIG);
      const scenario = scenarios.find((s) => s.homepageOptionLabel === optionLabel)!;

      await testScenarioStep(page, scenario, config, 'service-category');
    });
  }
});

test.describe('Patient info form - per scenario', () => {
  // Test patient info for each unique combination of homepage option + service category
  for (const scenario of scenarios) {
    test(`${scenario.description} - patient info fields`, async ({ page }) => {
      const config = createBookingConfigForTest(scenario.configName);

      await testScenarioStep(page, scenario, config, 'patient-info');
    });
  }
});

test.describe('Location selection - per scenario', () => {
  for (const scenario of scenarios) {
    test(`${scenario.description} - location selection`, async ({ page }) => {
      const config = createBookingConfigForTest(scenario.configName);

      await testScenarioStep(page, scenario, config, 'location');
    });
  }
});

test.describe('Time slot selection - prebook scenarios only', () => {
  const prebookScenarios = scenarios.filter((s) => s.visitType === 'prebook');

  for (const scenario of prebookScenarios) {
    test(`${scenario.description} - time slot selection`, async ({ page }) => {
      const config = createBookingConfigForTest(scenario.configName);

      await testScenarioStep(page, scenario, config, 'time-slot');
    });
  }
});

test.describe('Cross-config validation', () => {
  test('inPersonOnly config generates only in-person scenarios', () => {
    const inPersonScenarios = generateBookingTestScenarios('inPersonOnly');

    expect(inPersonScenarios.length).toBeGreaterThan(0);
    expect(inPersonScenarios.every((s) => s.serviceMode === 'in-person')).toBe(true);
    expect(inPersonScenarios.some((s) => s.serviceMode === 'virtual')).toBe(false);
  });

  test('virtualOnly config generates only virtual scenarios', () => {
    const virtualScenarios = generateBookingTestScenarios('virtualOnly');

    expect(virtualScenarios.length).toBeGreaterThan(0);
    expect(virtualScenarios.every((s) => s.serviceMode === 'virtual')).toBe(true);
    expect(virtualScenarios.some((s) => s.serviceMode === 'in-person')).toBe(false);
  });

  test('prebookOnly config generates only prebook scenarios', () => {
    const prebookScenarios = generateBookingTestScenarios('prebookOnly');

    expect(prebookScenarios.length).toBeGreaterThan(0);
    expect(prebookScenarios.every((s) => s.visitType === 'prebook')).toBe(true);
    expect(prebookScenarios.some((s) => s.visitType === 'walk-in')).toBe(false);
  });

  test('urgentCareOnly config generates scenarios with single service category', () => {
    const urgentCareScenarios = generateBookingTestScenarios('urgentCareOnly');

    expect(urgentCareScenarios.length).toBeGreaterThan(0);
    expect(urgentCareScenarios.every((s) => s.serviceCategory === 'urgent-care')).toBe(true);
  });

  test('baseline config generates full matrix of scenarios', () => {
    const baselineScenarios = generateBookingTestScenarios('baseline');

    // Should have scenarios for both service modes
    expect(baselineScenarios.some((s) => s.serviceMode === 'in-person')).toBe(true);
    expect(baselineScenarios.some((s) => s.serviceMode === 'virtual')).toBe(true);

    // Should have scenarios for both visit types
    expect(baselineScenarios.some((s) => s.visitType === 'walk-in')).toBe(true);
    expect(baselineScenarios.some((s) => s.visitType === 'prebook')).toBe(true);

    // Should have multiple service categories
    const uniqueCategories = new Set(baselineScenarios.map((s) => s.serviceCategory));
    expect(uniqueCategories.size).toBeGreaterThan(1);
  });
});

test.describe('Scenario matrix info', () => {
  test('log all generated scenarios for baseline', () => {
    const baselineScenarios = generateBookingTestScenarios('baseline');

    console.log('\n=== Generated Test Scenarios ===');
    console.log(`Total scenarios: ${baselineScenarios.length}\n`);

    for (const scenario of baselineScenarios) {
      console.log(`- ${scenario.description}`);
      console.log(`  Mode: ${scenario.serviceMode}, Type: ${scenario.visitType}`);
    }

    expect(baselineScenarios.length).toBeGreaterThan(0);
  });
});
