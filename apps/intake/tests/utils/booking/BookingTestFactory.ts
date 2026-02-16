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
import {
  createPaperworkCapabilityConfig,
  PaperworkCapabilityConfig,
  PaperworkConfigName,
} from '../config/PaperworkCapabilityConfig';
import { PaperworkConfigHelper } from '../config/PaperworkConfigHelper';
import { PagedQuestionnaireFlowHelper } from '../paperwork/PagedQuestionnaireFlowHelper';
import { getTestDataForPage } from '../paperwork/paperworkDataTemplates';
import { BookingFlowHelpers } from './BookingFlowHelpers';

/**
 * A test scenario representing one path through the booking system
 */
export interface BookingTestScenario {
  configName: string;
  homepageOptionId: string;
  homepageOptionLabel: string;
  serviceCategory?: string;
  description: string;
  visitType: 'walk-in' | 'prebook';
  serviceMode: 'in-person' | 'virtual';
  paperworkConfig?: PaperworkConfigName;
}

/**
 * Determine appropriate paperwork config for a booking scenario
 * Maps booking characteristics to specific paperwork configs to avoid permutation explosion
 */
function getPaperworkConfigForScenario(
  serviceCategory: string,
  visitType: 'walk-in' | 'prebook',
  serviceMode: 'in-person' | 'virtual'
): PaperworkConfigName {
  // Service-specific mappings (use appropriate config based on serviceMode)
  if (serviceCategory === 'workers-comp') {
    return serviceMode === 'virtual' ? 'workers-comp-virtual' : 'workers-comp-in-person';
  }
  if (serviceCategory === 'occ-med') {
    return serviceMode === 'virtual' ? 'occ-med-virtual' : 'occ-med-in-person';
  }

  // Mode-specific mappings for urgent-care
  if (serviceMode === 'virtual') {
    // Virtual walk-in: baseline with medical history
    // Virtual prebook: minimal without medical history
    return visitType === 'walk-in' ? 'baseline-virtual' : 'minimal-virtual';
  }

  // In-person mappings
  // Walk-in: baseline (full form)
  // Prebook: required-only (quick checkout)
  return visitType === 'walk-in' ? 'baseline-in-person' : 'required-only-in-person';
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
    const visitType = (option.id.includes('start') ? 'walk-in' : 'prebook') as 'walk-in' | 'prebook';
    const serviceMode = (option.id.includes('virtual') ? 'virtual' : 'in-person') as 'in-person' | 'virtual';

    if (serviceCategories.length === 1) {
      // Single service category - no selection needed
      const scenario = {
        configName,
        homepageOptionId: option.id,
        homepageOptionLabel: option.label,
        serviceCategory: serviceCategories[0].code,
        visitType,
        serviceMode,
        description: `${option.label} → ${serviceCategories[0].code}`,
        paperworkConfig: getPaperworkConfigForScenario(serviceCategories[0].code, visitType, serviceMode),
      };
      scenarios.push(scenario);
    } else {
      // Multiple service categories - generate scenario for each
      for (const category of serviceCategories) {
        const scenario = {
          configName,
          homepageOptionId: option.id,
          homepageOptionLabel: option.label,
          serviceCategory: category.code,
          visitType,
          serviceMode,
          description: `${option.label} → ${category.code}`,
          paperworkConfig: getPaperworkConfigForScenario(category.code, visitType, serviceMode),
        };
        scenarios.push(scenario);
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
 * @param paperworkConfig - Optional paperwork config name to complete paperwork after booking
 * @returns The appointment creation response with appointment ID and resources
 */
export async function executeBookingScenario(
  page: Page,
  scenario: BookingTestScenario,
  config: BookingConfig,
  testLocationName?: string,
  paperworkConfig?: PaperworkConfigName
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
  const paperworkConfigToUse = paperworkConfig || scenario.paperworkConfig;
  if (paperworkConfigToUse) {
    await completePaperwork(page, paperworkConfigToUse, scenario.serviceMode, scenario.visitType);
  }

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

/**
 * Complete paperwork flow based on capability config
 */
async function completePaperwork(
  page: Page,
  paperworkConfigName: PaperworkConfigName,
  serviceMode: 'in-person' | 'virtual',
  visitType: 'walk-in' | 'prebook'
): Promise<void> {
  const paperworkCapability = createPaperworkCapabilityConfig(paperworkConfigName);

  // Inject config overrides if needed
  if (paperworkCapability.configOverrides) {
    if (serviceMode === 'in-person') {
      await PaperworkConfigHelper.injectIntakePaperworkConfig(page, paperworkCapability.configOverrides);
    } else {
      await PaperworkConfigHelper.injectVirtualPaperworkConfig(page, paperworkCapability.configOverrides);
    }
  }

  // Navigate to paperwork from confirmation page
  // Virtual walk-in flows go directly to paperwork, others need to click "Proceed to paperwork"
  const currentUrl = page.url();
  if (!currentUrl.includes('/paperwork/')) {
    await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
  }

  // Wait for URL with page slug (app redirects from /paperwork/{id} to /paperwork/{id}/{pageSlug})
  // Pattern: /paperwork/{appointmentId}/{pageSlug}
  await page.waitForURL(/\/paperwork\/[^/]+\/[^/?]+/, { timeout: 30000 });

  // Create helper
  const helper = new PagedQuestionnaireFlowHelper(page, serviceMode);

  // Wait for first page to fully load
  await helper.waitForPage();

  // Generate and fill data based on config
  await fillPaperworkPages(page, helper, paperworkCapability, visitType);
}

/**
 * Fill all paperwork pages based on capability config
 *
 * Uses enableWhen evaluation to determine expected page flow and verifies
 * the app navigates to the correct pages. Fails if we end up on an unexpected page.
 */
async function fillPaperworkPages(
  page: Page,
  helper: PagedQuestionnaireFlowHelper,
  config: PaperworkCapabilityConfig,
  visitType: 'walk-in' | 'prebook'
): Promise<void> {
  // Get first visible page
  let currentPage = helper.getFirstVisiblePage();
  if (!currentPage) {
    throw new Error('No visible pages found in questionnaire');
  }

  console.log(`Starting paperwork flow. First page: ${currentPage.linkId}`);

  // Process pages until we reach review/completion
  while (!helper.isOnReviewPage()) {
    const pageLinkId = currentPage.linkId;

    // Verify we're on the expected page
    await helper.verifyOnExpectedPage(pageLinkId);
    console.log(`On expected page: ${pageLinkId}`);
    const { serviceMode, dataOptions } = config;
    const { serviceCategory } = dataOptions;
    // Get test data for this page
    const dataRequestContext = {
      visitType,
      serviceMode,
      serviceCategory,
    };
    const testData = getTestDataForPage(pageLinkId, dataRequestContext) ?? { valid: {} };

    // Fill page and capture the response (updates internal response tracking)
    await helper.fillPageAndContinue(testData.valid, pageLinkId);
    console.log(`Filled and submitted page: ${pageLinkId}`);

    // Check if we reached review page
    if (helper.isOnReviewPage()) {
      break;
    }

    // Calculate expected next page based on updated responses
    const nextPage = helper.getNextVisiblePage(pageLinkId);
    if (!nextPage) {
      // No more pages expected, but we're not on review page yet
      // This could be legitimate (app goes directly to review) or a bug
      console.log('No more visible pages calculated, checking if on review page...');
      await page.waitForURL(/\/(review|visit-confirmation)/, { timeout: 10000 });
      break;
    }

    currentPage = nextPage;
    console.log(`Next expected page: ${currentPage.linkId}`);

    // Wait for navigation to complete
    await helper.waitForPage();
  }

  // Should be on review page - wait for it to load
  await page.waitForURL(/\/review/);
  console.log('On review page');

  // Click the submit button on review page
  // Virtual flows show "Finish", in-person flows show "Continue"
  let submitButtonText: RegExp = /continue/i;
  if (config.serviceMode === 'virtual' && visitType === 'prebook') {
    submitButtonText = /finish/i;
  } else if (config.serviceMode === 'virtual' && visitType === 'walk-in') {
    submitButtonText = /Go to the Waiting Room/i;
  }
  const submitButton = page.getByRole('button', { name: submitButtonText });
  await submitButton.click();
  console.log('Clicked submit on review page');

  // Wait for completion page based on flow type:
  // - In-person walk-in → /check-in
  // - Prebook (any) → /visit/{appointmentId}
  // - Virtual walk-in → /waiting-room
  let expectedCompletionUrl: RegExp;
  if (config.serviceMode === 'in-person' && visitType === 'walk-in') {
    expectedCompletionUrl = /\/check-in/;
  } else if (visitType === 'prebook') {
    expectedCompletionUrl = /\/visit\/[a-f0-9-]+$/;
  } else {
    // Virtual walk-in
    expectedCompletionUrl = /\/waiting-room/;
  }

  await page.waitForURL(expectedCompletionUrl);
  console.log('Paperwork completed successfully');
}
