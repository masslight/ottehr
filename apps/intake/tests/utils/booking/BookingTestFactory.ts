/**
 * Booking flow test factory
 *
 * Generates e2e tests for all valid permutations of:
 * - Homepage options (start/schedule, in-person/virtual)
 * - Service categories (urgent-care, occ-med, workers-comp)
 * - Locations (if location-specific behavior needs testing)
 * - Paperwork configurations (field visibility variations)
 *
 * Each permutation becomes an independent parallel test.
 */

import { expect, Page } from '@playwright/test';
import { BookingConfig, createBookingConfigForTest } from 'utils';
import { BookingConfigHelper } from '../config/BookingConfigHelper';
import { BookingFlowHelpers } from './BookingFlowHelpers';

/**
 * A test scenario representing one path through the booking system
 */
interface BookingTestScenario {
  configName: string;
  homepageOptionId: string;
  homepageOptionLabel: string;
  serviceCategory?: string;
  description: string;
  visitType: 'walk-in' | 'prebook';
  serviceMode: 'in-person' | 'virtual';
}

/**
 * Generate all valid booking test scenarios from a config
 */
export function generateBookingTestScenarios(configName: string): BookingTestScenario[] {
  const config = createBookingConfigForTest(configName);
  const scenarios: BookingTestScenario[] = [];

  const homepageOptions = BookingConfigHelper.getHomepageOptions(config);
  const serviceCategories = BookingConfigHelper.getServiceCategories(config);

  for (const option of homepageOptions) {
    // Determine visit type and service mode from homepage option ID
    const visitType = option.id.includes('start') ? 'walk-in' : 'prebook';
    const serviceMode = option.id.includes('virtual') ? 'virtual' : 'in-person';

    if (serviceCategories.length === 1) {
      // Single service category - no selection needed
      scenarios.push({
        configName,
        homepageOptionId: option.id,
        homepageOptionLabel: option.label,
        serviceCategory: serviceCategories[0].code,
        visitType,
        serviceMode,
        description: `${option.label} → ${serviceCategories[0].code}`,
      });
    } else {
      // Multiple service categories - generate scenario for each
      for (const category of serviceCategories) {
        scenarios.push({
          configName,
          homepageOptionId: option.id,
          homepageOptionLabel: option.label,
          serviceCategory: category.code,
          visitType,
          serviceMode,
          description: `${option.label} → ${category.code}`,
        });
      }
    }
  }

  return scenarios;
}

/**
 * Execute a complete booking flow for a scenario
 */
export async function executeBookingScenario(
  page: Page,
  scenario: BookingTestScenario,
  config: BookingConfig
): Promise<void> {
  // 1. Start from homepage with selected option (using label)
  await BookingFlowHelpers.startBookingFlow(page, scenario.homepageOptionLabel);

  // 2. Select service category if needed
  if (scenario.serviceCategory) {
    await BookingFlowHelpers.selectServiceCategoryIfNeeded(page, config, scenario.serviceCategory);
  }

  // 3. Fill patient info based on visible fields
  const patientData = BookingFlowHelpers.getSamplePatientData();
  await BookingFlowHelpers.completePatientInfoStep(page, config, patientData);

  // 4. Location selection (walk-in) or time selection (prebook)
  if (scenario.visitType === 'walk-in') {
    await BookingFlowHelpers.selectFirstAvailableLocation(page);
  } else {
    await BookingFlowHelpers.selectFirstAvailableLocation(page);
    await BookingFlowHelpers.selectFirstAvailableTimeSlot(page);
  }

  // 5. Complete paperwork if required
  // TODO: Add paperwork filling based on config

  // 6. Confirm booking
  await BookingFlowHelpers.confirmBooking(page);
}

/**
 * Verify service category selection page behavior
 */
export async function verifyServiceCategorySelection(
  page: Page,
  config: BookingConfig,
  homepageOptionLabel: string
): Promise<void> {
  await BookingFlowHelpers.startBookingFlow(page, homepageOptionLabel);

  const categories = BookingConfigHelper.getServiceCategories(config);

  if (categories.length > 1) {
    // Should show service category selection page
    await expect(page.getByTestId('service-category-selection')).toBeVisible();

    // All categories should be visible as options
    for (const category of categories) {
      await expect(page.getByTestId(`service-category-${category.code}`)).toBeVisible();
    }
  } else {
    // Should skip directly to next step
    // Verify we're NOT on service category page
    await expect(page.getByTestId('service-category-selection')).not.toBeVisible();
  }
}

/**
 * Verify patient form fields match config
 */
export async function verifyPatientFormFields(page: Page, config: BookingConfig): Promise<void> {
  const visibleFields = BookingConfigHelper.getVisiblePatientFields(config);
  const hiddenFields = config.formConfig.FormFields.patientInfo.hiddenFields || [];

  // Verify visible fields are shown
  for (const fieldKey of visibleFields) {
    await expect(page.getByTestId(fieldKey)).toBeVisible();
  }

  // Verify hidden fields are NOT shown
  for (const fieldKey of hiddenFields) {
    await expect(page.getByTestId(fieldKey)).not.toBeVisible();
  }
}

/**
 * Test a specific step in isolation within a scenario context
 */
export async function testScenarioStep(
  page: Page,
  scenario: BookingTestScenario,
  config: BookingConfig,
  step: 'homepage' | 'service-category' | 'patient-info' | 'location' | 'time-slot' | 'paperwork' | 'confirmation'
): Promise<void> {
  // Navigate to the step
  await BookingFlowHelpers.startBookingFlow(page, scenario.homepageOptionLabel);

  switch (step) {
    case 'homepage':
      // Already there
      break;

    case 'service-category':
      await verifyServiceCategorySelection(page, config, scenario.homepageOptionLabel);
      break;

    case 'patient-info':
      if (scenario.serviceCategory) {
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(page, config, scenario.serviceCategory);
      }
      await verifyPatientFormFields(page, config);
      break;

    case 'location': {
      if (scenario.serviceCategory) {
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(page, config, scenario.serviceCategory);
      }
      const patientData = BookingFlowHelpers.getSamplePatientData();
      await BookingFlowHelpers.completePatientInfoStep(page, config, patientData);

      // Verify location selection page
      await expect(page.getByTestId('location-selection')).toBeVisible();
      break;
    }

    case 'time-slot':
      if (scenario.visitType !== 'prebook') {
        throw new Error('Time slot selection only applies to prebook flows');
      }

      if (scenario.serviceCategory) {
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(page, config, scenario.serviceCategory);
      }
      await BookingFlowHelpers.completePatientInfoStep(page, config, BookingFlowHelpers.getSamplePatientData());
      await BookingFlowHelpers.selectFirstAvailableLocation(page);

      // Verify time slot selection page
      await expect(page.getByTestId('time-slot-selection')).toBeVisible();
      break;

    case 'paperwork':
      // Navigate through entire flow to paperwork
      await executeBookingScenario(page, scenario, config);
      // TODO: Verify paperwork fields based on config
      break;

    case 'confirmation':
      await executeBookingScenario(page, scenario, config);
      await expect(page.getByTestId('booking-confirmation')).toBeVisible();
      break;
  }
}
