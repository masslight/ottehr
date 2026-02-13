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
import {
  BookingConfig,
  CreateAppointmentResponse,
  createBookingConfigForTest,
  getBookingCapabilityConfig,
} from 'utils';
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
 * @param page - Playwright page
 * @param scenario - The booking scenario to execute
 * @param config - The booking configuration
 * @param testLocationName - Optional 24/7 test location name (used for both walk-in and prebook flows)
 * @returns The appointment creation response with appointment ID and resources
 */
export async function executeBookingScenario(
  page: Page,
  scenario: BookingTestScenario,
  config: BookingConfig,
  testLocationName?: string
): Promise<CreateAppointmentResponse> {
  // Get the original capability config overrides for this scenario
  const capability = getBookingCapabilityConfig(scenario.configName);

  // For walk-in flows, add test location to the overrides
  const overrides: Partial<BookingConfig> = {
    ...capability.overrides,
    ...(testLocationName && { defaultWalkinLocationName: testLocationName }),
  };

  // Inject only the overrides (not the full merged config) before navigation
  await BookingConfigHelper.injectTestConfig(page, overrides);

  // 1. Start from homepage with selected option
  await BookingFlowHelpers.startBookingFlow(page, scenario.homepageOptionLabel);

  // 2. Select service category if needed
  if (scenario.serviceCategory) {
    await BookingFlowHelpers.selectServiceCategoryIfNeeded(
      page,
      config,
      scenario.serviceCategory,
      scenario.visitType,
      scenario.serviceMode
    );
  }

  // 3. Location/time selection order varies by flow type:
  // - Prebook (both in-person and virtual): location → time → patient info
  // - Walk-in virtual: location → patient info
  // - Walk-in in-person: patient info → location
  if (scenario.visitType === 'prebook') {
    await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
    await BookingFlowHelpers.selectFirstAvailableTimeSlot(page);
    await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after time slot selection');
  } else if (scenario.visitType === 'walk-in' && scenario.serviceMode === 'virtual') {
    // Virtual walk-in (start virtual visit): select location before patient info
    await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
    await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after location selection');
  }

  // 4. Fill patient info based on visible fields
  const patientData = BookingFlowHelpers.getSamplePatientData(scenario.serviceCategory);
  await BookingFlowHelpers.completePatientInfoStep(page, config, patientData, {
    serviceMode: scenario.serviceMode,
    serviceCategory: scenario.serviceCategory!,
  });

  // 5. For in-person walk-in flows WITHOUT a default location, select location AFTER patient info
  // When defaultWalkinLocationName is set, the app navigates to a location-specific route that skips location selection
  if (scenario.visitType === 'walk-in' && scenario.serviceMode === 'in-person' && !testLocationName) {
    await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
  }

  // 6. Confirm booking
  const appointmentResponse = await BookingFlowHelpers.confirmBooking(page, scenario.visitType, scenario.serviceMode);

  // 7. Complete paperwork if required
  // TODO: Add paperwork filling based on config

  return appointmentResponse;
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
    // Verify we're on the select service category page by checking URL or page title
    await expect(page).toHaveURL(/select-service-category/);

    // All categories should be visible as buttons with their display labels
    for (const category of categories) {
      await expect(page.getByRole('button', { name: category.display })).toBeVisible();
    }
  } else {
    // Should skip directly to next step
    // Verify we're NOT on service category page
    await expect(page).not.toHaveURL(/select-service-category/);
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
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(
          page,
          config,
          scenario.serviceCategory,
          scenario.visitType
        );
      }
      await verifyPatientFormFields(page, config);
      break;

    case 'location': {
      if (scenario.serviceCategory) {
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(
          page,
          config,
          scenario.serviceCategory,
          scenario.visitType
        );
      }
      const patientData = BookingFlowHelpers.getSamplePatientData(scenario.serviceCategory);
      await BookingFlowHelpers.completePatientInfoStep(page, config, patientData, {
        serviceMode: scenario.serviceMode,
        serviceCategory: scenario.serviceCategory!,
      });

      // Verify location selection page
      await expect(page.getByTestId('location-selection')).toBeVisible();
      break;
    }

    case 'time-slot': {
      if (scenario.visitType !== 'prebook') {
        throw new Error('Time slot selection only applies to prebook flows');
      }

      if (scenario.serviceCategory) {
        await BookingFlowHelpers.selectServiceCategoryIfNeeded(
          page,
          config,
          scenario.serviceCategory,
          scenario.visitType
        );
      }
      await BookingFlowHelpers.completePatientInfoStep(
        page,
        config,
        BookingFlowHelpers.getSamplePatientData(scenario.serviceCategory),
        {
          serviceMode: scenario.serviceMode,
          serviceCategory: scenario.serviceCategory!,
        }
      );
      await BookingFlowHelpers.selectFirstAvailableLocation(page);

      // Verify time slot selection page
      await expect(page.getByTestId('time-slot-selection')).toBeVisible();
      break;
    }

    case 'paperwork': {
      // Navigate through entire flow to paperwork
      const _paperworkResponse = await executeBookingScenario(page, scenario, config);
      // TODO: Verify paperwork fields based on config
      // Appointment response available as: _paperworkResponse
      break;
    }

    case 'confirmation': {
      const _confirmationResponse = await executeBookingScenario(page, scenario, config);
      // Confirmation is verified in BookingFlowHelpers.confirmBooking() via "Proceed to paperwork" button
      // Appointment response available as: _confirmationResponse
      break;
    }
  }
}
