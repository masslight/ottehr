/**
 * Booking flow test factory
 *
 * Generates e2e tests for all valid permutations of:
 * - Homepage options (start/schedule, in-person/virtual)
 * - Service categories (urgent-care, occupational-medicine, workers-comp)
 * - Locations (if location-specific behavior needs testing)
 * - Paperwork configurations (field visibility variations)
 *
 * Each permutation becomes an independent parallel test.
 */

import { Page } from '@playwright/test';
import {
  BookingConfig,
  CanonicalUrl,
  CreateAppointmentResponse,
  getBookingCapabilityConfig,
  getBookingConfig,
  getIntakePaperworkConfig,
  getIntakePaperworkVirtualConfig,
  getValueSets,
} from 'utils';
import { CONCRETE_TEST_CONFIGS } from '../booking-flow-concrete-smoke-configs';
import { BookingConfigHelper } from '../config/BookingConfigHelper';
import { createPaperworkCapabilityConfig, PaperworkConfigName } from '../config/PaperworkCapabilityConfig';
import { PaperworkConfigHelper } from '../config/PaperworkConfigHelper';
import { PagedQuestionnaireFlowHelper } from '../paperwork/PagedQuestionnaireFlowHelper';
import { getTestDataForPage } from '../paperwork/paperworkDataTemplates';
import { BookingFlowHelpers } from './BookingFlowHelpers';

/**
 * A test scenario representing one path through the booking system
 */
/**
 * The type of bookable entity used for location selection in tests.
 * - 'Location': Direct Location resource (most downstream instances)
 * - 'Group': HealthcareService with Location and Practitioner members (core environment pattern)
 */
export type BookableEntityType = 'Location' | 'Group';

export interface BookingTestScenario {
  configName: string;
  homepageOptionId: string;
  homepageOptionLabel: string;
  serviceCategory?: string;
  description: string;
  visitType: 'walk-in' | 'prebook';
  serviceMode: 'in-person' | 'virtual';
  fillingStrategy: FillingStrategy;
  bookingStrategy?: BookingStrategy;
  /** Fully resolved booking config (merged with defaults) */
  resolvedConfig: BookingConfig;
  /** Raw booking overrides to inject before navigation */
  bookingOverrides: Partial<BookingConfig>;
  /** Fully resolved paperwork config (in-person or virtual based on serviceMode) */
  resolvedPaperworkConfig?: any;
  /** Fully resolved value sets config */
  resolvedValueSetConfig?: any;
  /** Test questionnaire canonical URL (used to override the default questionnaire for e2e tests) */
  testQuestionnaireCanonical?: CanonicalUrl;
  /** Type of bookable entity for location selection. Defaults to 'Location'. */
  bookableEntityType?: BookableEntityType;
  /** Slug for Group booking (HealthcareService). Used to construct bookingOn URL param. */
  groupBookingSlug?: string;
}

export interface QuestionnaireFieldAddress {
  pageLinkId: string;
  fieldLinkId: string;
}
export interface FillingStrategy {
  checkValidation: boolean;
  fillAllFields: boolean;
  verifyFieldsNotShown?: QuestionnaireFieldAddress[];
}

export interface BookingStrategy {
  inPersonPrebookLocation: string;
  virtualPrebookLocation: string;
  inPersonWalkInLocation: string;
  virtualWalkInLocation: string;
}

/**
 * Determine the filling strategy for a booking scenario
 * Enables validation checking for specific scenario types to test form validation
 */
function getFillingStrategyForScenario(
  serviceCategory: string,
  visitType: 'walk-in' | 'prebook',
  serviceMode: 'in-person' | 'virtual'
): FillingStrategy {
  // Enable validation checking for:
  // - In-person walk-in urgent-care
  // - Prebook virtual urgent-care
  const shouldCheckValidation =
    (serviceCategory === 'urgent-care' && visitType === 'walk-in' && serviceMode === 'in-person') ||
    (serviceCategory === 'urgent-care' && visitType === 'prebook' && serviceMode === 'virtual');

  return {
    checkValidation: shouldCheckValidation,
    fillAllFields: true,
  };
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
  if (serviceCategory === 'occupational-medicine') {
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
export async function generateBookingTestScenarios(configName: string): Promise<BookingTestScenario[]> {
  const scenarios: BookingTestScenario[] = [];

  // Get capability config overrides and resolved config
  const capability = getBookingCapabilityConfig(configName);
  const capabilityOverrides = capability.overrides;
  const resolvedConfig = getBookingConfig(capabilityOverrides);

  const homepageOptions = BookingConfigHelper.getHomepageOptions(resolvedConfig);
  const serviceCategories = BookingConfigHelper.getServiceCategories(resolvedConfig);

  for (const option of homepageOptions) {
    // Determine visit type and service mode from homepage option ID
    const visitType = (option.id.includes('start') ? 'walk-in' : 'prebook') as 'walk-in' | 'prebook';
    const serviceMode = (option.id.includes('virtual') ? 'virtual' : 'in-person') as 'in-person' | 'virtual';

    if (serviceCategories.length === 1) {
      // Single service category - no selection needed
      const categoryCode = serviceCategories[0].code;
      const paperworkConfigName = getPaperworkConfigForScenario(categoryCode, visitType, serviceMode);
      const paperworkCapability = createPaperworkCapabilityConfig(paperworkConfigName);
      // Resolve paperwork config using the appropriate function based on service mode
      const resolvedPaperworkConfig =
        serviceMode === 'virtual'
          ? getIntakePaperworkVirtualConfig(paperworkCapability.configOverrides)
          : getIntakePaperworkConfig(paperworkCapability.configOverrides as any); // todo
      const scenario: BookingTestScenario = {
        configName,
        homepageOptionId: option.id,
        homepageOptionLabel: option.label,
        serviceCategory: categoryCode,
        visitType,
        serviceMode,
        description: `${option.label} → ${categoryCode}`,
        fillingStrategy: getFillingStrategyForScenario(categoryCode, visitType, serviceMode),
        resolvedConfig,
        bookingOverrides: capabilityOverrides,
        resolvedPaperworkConfig,
      };
      scenarios.push(scenario);
    } else {
      // Multiple service categories - generate scenario for each
      for (const category of serviceCategories) {
        const paperworkConfigName = getPaperworkConfigForScenario(category.code, visitType, serviceMode);
        const paperworkCapability = createPaperworkCapabilityConfig(paperworkConfigName);
        // Resolve paperwork config using the appropriate function based on service mode
        const resolvedPaperworkConfig =
          serviceMode === 'virtual'
            ? getIntakePaperworkVirtualConfig(paperworkCapability.configOverrides)
            : getIntakePaperworkConfig(paperworkCapability.configOverrides as any);
        const scenario: BookingTestScenario = {
          configName,
          homepageOptionId: option.id,
          homepageOptionLabel: option.label,
          serviceCategory: category.code,
          visitType,
          serviceMode,
          description: `${option.label} → ${category.code}`,
          fillingStrategy: getFillingStrategyForScenario(category.code, visitType, serviceMode),
          resolvedConfig,
          bookingOverrides: capabilityOverrides,
          resolvedPaperworkConfig,
        };
        scenarios.push(scenario);
      }
    }
  }

  // Generate scenarios from concrete smoke test configs
  // Each concrete config represents a specific instance configuration
  // We pass the overrides through the same config resolution as the app
  //
  // NOTE: Concrete tests only run in the upstream ottehr repo.
  // Downstream instances set RUN_CONCRETE_TESTS=false (or don't set it) to skip these.
  const runConcreteTests = process.env.RUN_CONCRETE_TESTS === 'true';
  if (!runConcreteTests) {
    console.log('[BookingTestFactory] Skipping concrete config scenarios (RUN_CONCRETE_TESTS != true)');
    return scenarios;
  }

  const concreteTestConfigs = await CONCRETE_TEST_CONFIGS;
  console.error('[BookingTestFactory] CONCRETE_TEST_CONFIGS:', concreteTestConfigs);
  for (const concreteConfig of concreteTestConfigs) {
    const { bookingOverrides, fillingStrategy, paperworkConfigInPerson, paperworkConfigVirtual, valueSetsOverrides } =
      concreteConfig;

    // Create a properly merged config using the same resolution as the app
    const concreteResolvedConfig = getBookingConfig(bookingOverrides);

    // Use the same helper methods to extract homepage options and service categories
    const concreteHomepageOptions = BookingConfigHelper.getHomepageOptions(concreteResolvedConfig);
    const concreteServiceCategories = BookingConfigHelper.getServiceCategories(concreteResolvedConfig);

    console.error('[BookingTestFactory] concreteHomepageOptions:', concreteHomepageOptions);
    for (const option of concreteHomepageOptions) {
      if (!option || !option.id) {
        console.error('[BookingTestFactory] Skipping undefined or invalid homepage option:', option);
        continue;
      }
      console.error('[BookingTestFactory] Processing homepage option:', option);
      const visitType = (option.id.includes('start') ? 'walk-in' : 'prebook') as 'walk-in' | 'prebook';
      const serviceMode = (option.id.includes('virtual') ? 'virtual' : 'in-person') as 'in-person' | 'virtual';

      // Select appropriate paperwork overrides based on service mode
      const paperworkOverrides = serviceMode === 'virtual' ? paperworkConfigVirtual : paperworkConfigInPerson;

      if (concreteServiceCategories.length === 1) {
        const categoryCode = concreteServiceCategories[0].code;
        // Resolve paperwork config using the appropriate function based on service mode
        const resolvedPaperworkConfig =
          serviceMode === 'virtual'
            ? getIntakePaperworkVirtualConfig(paperworkOverrides)
            : getIntakePaperworkConfig(paperworkOverrides);
        const resolvedValueSetConfig = getValueSets(valueSetsOverrides || {});
        const scenario: BookingTestScenario = {
          configName: `concrete:${concreteConfig.id}`,
          homepageOptionId: option.id,
          homepageOptionLabel: option.label,
          serviceCategory: categoryCode,
          visitType,
          serviceMode,
          description: `[${concreteConfig.name}] ${option.label} → ${categoryCode}`,
          fillingStrategy,
          resolvedConfig: concreteResolvedConfig,
          bookingOverrides: bookingOverrides || {},
          resolvedPaperworkConfig,
          resolvedValueSetConfig,
        };
        scenarios.push(scenario);
      } else {
        for (const category of concreteServiceCategories) {
          // Resolve paperwork config using the appropriate function based on service mode
          const resolvedPaperworkConfig =
            serviceMode === 'virtual'
              ? getIntakePaperworkVirtualConfig(paperworkOverrides)
              : getIntakePaperworkConfig(paperworkOverrides);
          const resolvedValueSetConfig = getValueSets(valueSetsOverrides || {});
          const scenario: BookingTestScenario = {
            configName: `concrete:${concreteConfig.id}`,
            homepageOptionId: option.id,
            homepageOptionLabel: option.label,
            serviceCategory: category.code,
            visitType,
            serviceMode,
            description: `[${concreteConfig.name}] ${option.label} → ${category.code}`,
            fillingStrategy,
            resolvedConfig: concreteResolvedConfig,
            bookingOverrides: bookingOverrides || {},
            resolvedPaperworkConfig,
            resolvedValueSetConfig,
          };
          scenarios.push(scenario);
        }
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
  testLocationName?: string,
  paperworkConfig?: PaperworkConfigName
): Promise<CreateAppointmentResponse> {
  // Use scenario's pre-resolved config and overrides
  const { resolvedConfig, bookingOverrides, resolvedValueSetConfig } = scenario;

  // For walk-in flows, add test location to the overrides
  const overrides: Partial<BookingConfig> = {
    ...bookingOverrides,
    ...(testLocationName && { defaultWalkinLocationName: testLocationName }),
  };

  await PaperworkConfigHelper.injectValueSets(page, resolvedValueSetConfig || {});

  // Inject only the overrides (not the full merged config) before navigation
  await BookingConfigHelper.injectTestConfig(page, overrides);

  // Inject paperwork config before navigation (must happen before app loads)
  if (scenario.resolvedPaperworkConfig) {
    if (scenario.serviceMode === 'in-person') {
      await PaperworkConfigHelper.injectIntakePaperworkConfig(page, scenario.resolvedPaperworkConfig);
    } else {
      await PaperworkConfigHelper.injectVirtualPaperworkConfig(page, scenario.resolvedPaperworkConfig);
    }
  }

  // Set up route interception to inject test questionnaire canonical into create-appointment requests
  // This allows e2e tests to use custom questionnaires with specific config overrides
  if (scenario.testQuestionnaireCanonical) {
    console.log('Setting up route interception for test questionnaire canonical:', scenario.testQuestionnaireCanonical);
    await page.route('**/create-appointment/execute', async (route, request) => {
      const postData = request.postDataJSON();
      const modifiedData = {
        ...postData,
        testQuestionnaireCanonical: scenario.testQuestionnaireCanonical,
      };
      await route.continue({
        postData: JSON.stringify(modifiedData),
      });
    });
  }

  // 1. Start from homepage with selected option
  await BookingFlowHelpers.startBookingFlow(page, scenario.homepageOptionLabel);

  // 2. Select service category if needed
  if (scenario.serviceCategory) {
    await BookingFlowHelpers.selectServiceCategoryIfNeeded(
      page,
      resolvedConfig,
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
    if (scenario.bookableEntityType === 'Group' && scenario.groupBookingSlug) {
      // Group booking: navigate directly to prebook URL with bookingOn and scheduleType params
      // This bypasses the location dropdown since the HealthcareService is specified in the URL
      const groupBookingUrl = `/prebook/${scenario.serviceMode}?bookingOn=${scenario.groupBookingSlug}&scheduleType=group`;
      console.log(`Navigating to Group booking URL: ${groupBookingUrl}`);
      await page.goto(groupBookingUrl, { waitUntil: 'networkidle' });
    } else {
      // Standard Location booking: select from dropdown
      await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
    }
    await BookingFlowHelpers.selectFirstAvailableTimeSlot(page);
    await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after time slot selection');
  } else if (scenario.visitType === 'walk-in' && scenario.serviceMode === 'virtual') {
    // Virtual walk-in (start virtual visit): select location before patient info
    await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
    await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after location selection');
  }

  // 4. Fill patient info based on visible fields
  const patientTestData = BookingFlowHelpers.getSamplePatientData(scenario.serviceCategory);
  await BookingFlowHelpers.completePatientInfoStep(
    page,
    resolvedConfig,
    patientTestData,
    {
      serviceMode: scenario.serviceMode,
      serviceCategory: scenario.serviceCategory!,
    },
    scenario.fillingStrategy
  );

  // 5. For in-person walk-in flows WITHOUT a default location, select location AFTER patient info
  // When defaultWalkinLocationName is set, the app navigates to a location-specific route that skips location selection
  if (scenario.visitType === 'walk-in' && scenario.serviceMode === 'in-person' && !testLocationName) {
    await BookingFlowHelpers.selectFirstAvailableLocation(page, testLocationName, scenario.serviceMode);
  }

  // 6. Confirm booking
  const appointmentResponse = await BookingFlowHelpers.confirmBooking(page, scenario.visitType, scenario.serviceMode);

  // 7. Complete paperwork if required
  // Use explicit paperworkConfig if provided, otherwise use scenario's resolved config
  let paperworkConfigToUse = scenario.resolvedPaperworkConfig;
  if (paperworkConfig) {
    // Override with explicit named config
    const paperworkCapability = createPaperworkCapabilityConfig(paperworkConfig);
    paperworkConfigToUse =
      scenario.serviceMode === 'virtual'
        ? getIntakePaperworkVirtualConfig(paperworkCapability.configOverrides)
        : getIntakePaperworkConfig(paperworkCapability.configOverrides as any); // todo
  }

  if (paperworkConfigToUse) {
    const serviceCategory =
      (scenario.serviceCategory as 'urgent-care' | 'workers-comp' | 'occupational-medicine') || 'urgent-care';
    await completePaperwork({
      page,
      serviceMode: scenario.serviceMode,
      visitType: scenario.visitType,
      fillingStrategy: scenario.fillingStrategy,
      serviceCategory,
      resolvedPaperworkConfig: paperworkConfigToUse,
    });
  }

  return appointmentResponse;
}

/**
 * Parameters for completing paperwork
 */
interface CompletePaperworkParams {
  page: Page;
  serviceMode: 'in-person' | 'virtual';
  visitType: 'walk-in' | 'prebook';
  fillingStrategy: FillingStrategy;
  serviceCategory: 'urgent-care' | 'workers-comp' | 'occupational-medicine';
  /** Fully resolved paperwork config */
  resolvedPaperworkConfig: any;
}

/**
 * Complete paperwork flow using resolved config
 */
async function completePaperwork(params: CompletePaperworkParams): Promise<void> {
  const { page, serviceMode, visitType, fillingStrategy, serviceCategory, resolvedPaperworkConfig } = params;

  // Inject the resolved config (the app's merge will use it as-is)
  if (serviceMode === 'in-person') {
    await PaperworkConfigHelper.injectIntakePaperworkConfig(page, resolvedPaperworkConfig);
  } else {
    await PaperworkConfigHelper.injectVirtualPaperworkConfig(page, resolvedPaperworkConfig);
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

  // Create helper with config overrides (for concrete configs, this ensures the helper
  // uses the same questionnaire structure as the one deployed to FHIR)
  const helper = new PagedQuestionnaireFlowHelper(page, serviceMode, resolvedPaperworkConfig);

  // Wait for first page to fully load
  await helper.waitForPage();

  // Generate and fill data based on config
  await fillPaperworkPages({
    page,
    helper,
    serviceMode,
    serviceCategory,
    visitType,
    fillingStrategy,
  });
}

/**
 * Parameters for filling paperwork pages
 */
interface FillPaperworkParams {
  page: Page;
  helper: PagedQuestionnaireFlowHelper;
  serviceMode: 'in-person' | 'virtual';
  serviceCategory: 'urgent-care' | 'workers-comp' | 'occupational-medicine';
  visitType: 'walk-in' | 'prebook';
  fillingStrategy: FillingStrategy;
}

/**
 * Fill all paperwork pages based on capability config
 *
 * Uses enableWhen evaluation to determine expected page flow and verifies
 * the app navigates to the correct pages. Fails if we end up on an unexpected page.
 */
async function fillPaperworkPages(params: FillPaperworkParams): Promise<void> {
  const { page, helper, serviceMode, serviceCategory, visitType, fillingStrategy } = params;

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

    // Verify fields that should NOT be shown on this page
    const fieldsNotShownOnThisPage = (fillingStrategy.verifyFieldsNotShown ?? [])
      .filter((field) => field.pageLinkId === pageLinkId)
      .map((field) => field.fieldLinkId);

    if (fieldsNotShownOnThisPage.length > 0) {
      console.log(
        `Verifying ${fieldsNotShownOnThisPage.length} fields are NOT shown: ${fieldsNotShownOnThisPage.join(', ')}`
      );
      await helper.verifyFieldsNotShown(fieldsNotShownOnThisPage);
    }

    // Get test data for this page
    const dataRequestContext = {
      visitType,
      serviceMode,
      serviceCategory,
    };
    const testData = getTestDataForPage(pageLinkId, dataRequestContext) ?? { valid: {} };

    // Check if validation testing is enabled and page has invalid data
    const { checkValidation } = fillingStrategy;
    if (checkValidation && testData.invalid && Object.keys(testData.invalid).length > 0) {
      // Fill invalid values first, verify validation errors, then correct and submit
      console.log(`Validation check enabled for page: ${pageLinkId}`);
      const { validationErrors } = await helper.fillPageWithValidationCheck(
        testData.valid,
        testData.invalid,
        pageLinkId
      );
      console.log(`Validation errors found: ${validationErrors.length} - ${validationErrors.join(', ')}`);
    } else {
      // Standard flow: fill page with valid values and continue
      await helper.fillPageAndContinue(testData.valid, pageLinkId);
    }
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
      await page.waitForURL(/\/(review|visit-confirmation)/, { timeout: 30000 });
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
  if (serviceMode === 'virtual' && visitType === 'prebook') {
    submitButtonText = /finish/i;
  } else if (serviceMode === 'virtual' && visitType === 'walk-in') {
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
  if (serviceMode === 'in-person' && visitType === 'walk-in') {
    expectedCompletionUrl = /\/check-in/;
  } else if (visitType === 'prebook') {
    expectedCompletionUrl = /\/visit\/[a-f0-9-]+/;
  } else {
    // Virtual walk-in
    expectedCompletionUrl = /\/waiting-room/;
  }

  await page.waitForURL(expectedCompletionUrl);
  console.log('Paperwork completed successfully');
}
