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
  BOOKING_CONFIG,
  BookingConfig,
  CanonicalUrl,
  CONFIG_INJECTION_KEYS,
  CreateAppointmentResponse,
  INTAKE_PAPERWORK_CONFIG,
  VIRTUAL_INTAKE_PAPERWORK_CONFIG,
} from 'utils';
import { injectTestConfig } from '../config/injectTestConfig';
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
 * Generate all valid booking test scenarios from the instance's BOOKING_CONFIG
 *
 * Uses the actual BOOKING_CONFIG which has downstream overrides already applied,
 * so test scenarios match what the instance actually supports (homepage options,
 * service categories, etc.)
 */
export async function generateBookingTestScenarios(): Promise<BookingTestScenario[]> {
  const scenarios: BookingTestScenario[] = [];

  // Use the actual BOOKING_CONFIG which has downstream overrides baked in
  const resolvedConfig = BOOKING_CONFIG as BookingConfig;

  // Extract key config values that need to be injected into the app at runtime
  // This ensures the app sees the same config as the test expectations
  const bookingOverridesToInject: Partial<BookingConfig> = {
    serviceCategories: resolvedConfig.serviceCategories,
    serviceCategoriesEnabled: resolvedConfig.serviceCategoriesEnabled,
    homepageOptions: resolvedConfig.homepageOptions,
  };

  const homepageOptions = resolvedConfig.homepageOptions;
  const serviceCategories = resolvedConfig.serviceCategories;
  const { serviceCategoriesEnabled } = resolvedConfig;

  for (const option of homepageOptions) {
    // Determine visit type and service mode from homepage option ID
    const visitType = (option.id.includes('start') ? 'walk-in' : 'prebook') as 'walk-in' | 'prebook';
    const serviceMode = (option.id.includes('virtual') ? 'virtual' : 'in-person') as 'in-person' | 'virtual';

    // Check if service category selection is enabled for this flow type
    const categorySelectionEnabled =
      serviceCategoriesEnabled.serviceModes.includes(serviceMode) &&
      serviceCategoriesEnabled.visitType.includes(visitType);

    // Determine which categories to generate scenarios for
    // If category selection is disabled for this flow, only use 'urgent-care' by convention
    const categoriesToTest =
      categorySelectionEnabled && serviceCategories.length > 1
        ? serviceCategories
        : [serviceCategories.find((c) => c.code === 'urgent-care') || serviceCategories[0]];

    for (const category of categoriesToTest) {
      // Use the pre-resolved instance paperwork config (has downstream overrides baked in)
      const resolvedPaperworkConfig =
        serviceMode === 'virtual' ? VIRTUAL_INTAKE_PAPERWORK_CONFIG : INTAKE_PAPERWORK_CONFIG;
      const scenario: BookingTestScenario = {
        configName: 'instance',
        homepageOptionId: option.id,
        homepageOptionLabel: option.label,
        serviceCategory: category.code,
        visitType,
        serviceMode,
        description: `${option.label} → ${category.code}`,
        fillingStrategy: getFillingStrategyForScenario(category.code, visitType, serviceMode),
        resolvedConfig,
        bookingOverrides: bookingOverridesToInject,
        resolvedPaperworkConfig,
      };
      scenarios.push(scenario);
    }
  }

  // Ensure we have enough scenarios to cover all extensions
  // Extensions require minimum counts per flow type:
  // - 2 in-person walk-ins (returning-patient + past-visits fallback)
  // - 2 in-person prebooks (modify + cancel)
  // - 2 virtual walk-ins (participants + review-page fallback)
  ensureExtensionCoverage(scenarios, resolvedConfig, bookingOverridesToInject);

  // Annotate scenario descriptions with their extended flow coverage
  annotateScenarioDescriptions(scenarios);

  return scenarios;
}

/**
 * Extension coverage requirements by flow type
 * Each extension needs a specific scenario type to attach to
 */
interface ExtensionRequirements {
  inPersonWalkins: number; // returning-patient (1st) + past-visits fallback (2nd)
  inPersonPrebooks: number; // modify (1st) + cancel (2nd)
  virtualWalkins: number; // participants (1st) + review-page fallback (2nd)
  virtualPrebooks: number; // no specific requirements, but helps with past-visits/review-page
}

const MINIMUM_EXTENSION_REQUIREMENTS: ExtensionRequirements = {
  inPersonWalkins: 2,
  inPersonPrebooks: 2,
  virtualWalkins: 2,
  virtualPrebooks: 0, // No specific minimum, but duplicates help reach prebook[2] and prebook[3]
};

/**
 * Ensure we have enough scenarios to cover all extensions
 *
 * When there aren't enough service categories to generate sufficient scenarios,
 * this function duplicates existing scenarios to ensure all extensions get tested.
 * Duplicates use the same service category but are marked as extension-only tests.
 */
function ensureExtensionCoverage(
  scenarios: BookingTestScenario[],
  _resolvedConfig: BookingConfig,
  _bookingOverrides: Partial<BookingConfig>
): void {
  // Count current scenarios by flow type
  const counts = {
    inPersonWalkins: scenarios.filter((s) => s.visitType === 'walk-in' && s.serviceMode === 'in-person').length,
    inPersonPrebooks: scenarios.filter((s) => s.visitType === 'prebook' && s.serviceMode === 'in-person').length,
    virtualWalkins: scenarios.filter((s) => s.visitType === 'walk-in' && s.serviceMode === 'virtual').length,
    virtualPrebooks: scenarios.filter((s) => s.visitType === 'prebook' && s.serviceMode === 'virtual').length,
  };

  // Calculate how many duplicates we need for each flow type
  const needed = {
    inPersonWalkins: Math.max(0, MINIMUM_EXTENSION_REQUIREMENTS.inPersonWalkins - counts.inPersonWalkins),
    inPersonPrebooks: Math.max(0, MINIMUM_EXTENSION_REQUIREMENTS.inPersonPrebooks - counts.inPersonPrebooks),
    virtualWalkins: Math.max(0, MINIMUM_EXTENSION_REQUIREMENTS.virtualWalkins - counts.virtualWalkins),
    virtualPrebooks: Math.max(0, MINIMUM_EXTENSION_REQUIREMENTS.virtualPrebooks - counts.virtualPrebooks),
  };

  const totalNeeded = needed.inPersonWalkins + needed.inPersonPrebooks + needed.virtualWalkins + needed.virtualPrebooks;

  if (totalNeeded === 0) {
    return; // We have enough scenarios already
  }

  console.log(`Adding ${totalNeeded} duplicate scenarios for extension coverage:`, needed);

  // Find template scenarios to duplicate (prefer the first of each type)
  const templates = {
    inPersonWalkin: scenarios.find((s) => s.visitType === 'walk-in' && s.serviceMode === 'in-person'),
    inPersonPrebook: scenarios.find((s) => s.visitType === 'prebook' && s.serviceMode === 'in-person'),
    virtualWalkin: scenarios.find((s) => s.visitType === 'walk-in' && s.serviceMode === 'virtual'),
    virtualPrebook: scenarios.find((s) => s.visitType === 'prebook' && s.serviceMode === 'virtual'),
  };

  // Helper to create a duplicate scenario
  const createDuplicate = (template: BookingTestScenario, index: number): BookingTestScenario => ({
    ...template,
    description: `${template.description} (ext-${index + 1})`,
    // Duplicates don't need validation checking - they're just for extension coverage
    fillingStrategy: { ...template.fillingStrategy, checkValidation: false },
  });

  // Add duplicates for each flow type that needs them
  if (templates.inPersonWalkin) {
    for (let i = 0; i < needed.inPersonWalkins; i++) {
      scenarios.push(createDuplicate(templates.inPersonWalkin, counts.inPersonWalkins + i));
    }
  }

  if (templates.inPersonPrebook) {
    for (let i = 0; i < needed.inPersonPrebooks; i++) {
      scenarios.push(createDuplicate(templates.inPersonPrebook, counts.inPersonPrebooks + i));
    }
  }

  if (templates.virtualWalkin) {
    for (let i = 0; i < needed.virtualWalkins; i++) {
      scenarios.push(createDuplicate(templates.virtualWalkin, counts.virtualWalkins + i));
    }
  }

  if (templates.virtualPrebook) {
    for (let i = 0; i < needed.virtualPrebooks; i++) {
      scenarios.push(createDuplicate(templates.virtualPrebook, counts.virtualPrebooks + i));
    }
  }
}

/**
 * Annotate scenario descriptions with extended flow indicators
 * This makes it easy to see which tests include extended coverage in Playwright UI
 */
function annotateScenarioDescriptions(scenarios: BookingTestScenario[]): void {
  // Group scenarios by configName to evaluate extensions within each config
  const configGroups = new Map<string, BookingTestScenario[]>();
  for (const scenario of scenarios) {
    const group = configGroups.get(scenario.configName) || [];
    group.push(scenario);
    configGroups.set(scenario.configName, group);
  }

  for (const [, configScenarios] of configGroups) {
    // Find scenarios that will receive each extension type
    const inPersonWalkins = configScenarios.filter((s) => s.visitType === 'walk-in' && s.serviceMode === 'in-person');
    const virtualWalkins = configScenarios.filter((s) => s.visitType === 'walk-in' && s.serviceMode === 'virtual');
    const inPersonPrebooks = configScenarios.filter((s) => s.visitType === 'prebook' && s.serviceMode === 'in-person');
    const allPrebooks = configScenarios.filter((s) => s.visitType === 'prebook');

    // Returning patient: first in-person walk-in
    if (inPersonWalkins[0]) {
      inPersonWalkins[0].description += ' [+ returning patient]';
    }

    // Modification: first in-person prebook
    if (inPersonPrebooks[0]) {
      inPersonPrebooks[0].description += ' [+ modify]';
    }

    // Cancellation: second in-person prebook
    if (inPersonPrebooks[1]) {
      inPersonPrebooks[1].description += ' [+ cancel]';
    }

    // Waiting room participants: first virtual walk-in
    if (virtualWalkins[0]) {
      virtualWalkins[0].description += ' [+ participants]';
    }

    // Past visits: third prebook OR second in-person walk-in
    if (allPrebooks[2]) {
      allPrebooks[2].description += ' [+ past visits]';
    } else if (inPersonWalkins[1]) {
      inPersonWalkins[1].description += ' [+ past visits]';
    }

    // Review page: fourth prebook OR second virtual walk-in
    if (allPrebooks[3]) {
      allPrebooks[3].description += ' [+ review page]';
    } else if (virtualWalkins[1]) {
      virtualWalkins[1].description += ' [+ review page]';
    }
  }
}

/**
 * Result from executing a booking scenario
 */
export interface BookingScenarioResult {
  /** The appointment creation response */
  appointmentResponse: CreateAppointmentResponse;
  /** The paperwork helper with collected responses (for enableWhen evaluation) */
  paperworkHelper?: PagedQuestionnaireFlowHelper;
}

/**
 * Execute a complete booking flow for a scenario
 * @param page - Playwright page
 * @param scenario - The booking scenario to execute
 * @param config - The booking configuration
 * @param testLocationName - Optional 24/7 test location name (used for both walk-in and prebook flows)
 * @returns The booking result including appointment response and paperwork helper
 */
export async function executeBookingScenario(
  page: Page,
  scenario: BookingTestScenario,
  testLocationName?: string
): Promise<BookingScenarioResult> {
  // Use scenario's pre-resolved config and overrides
  const { resolvedConfig, bookingOverrides } = scenario;

  // For walk-in flows, add test location to the overrides
  // For prebook in-person flows NOT using Group booking, clear inPersonPrebookRoutingParams
  // so the test can select its own location instead of using the default routing
  const shouldClearPrebookRouting =
    scenario.visitType === 'prebook' && scenario.serviceMode === 'in-person' && scenario.bookableEntityType !== 'Group';

  // Include test questionnaire canonical in booking config if set
  // The app reads this from config and passes to create-slot, which stores it on the Slot extension
  const questionnaireCanonicalOverride =
    scenario.testQuestionnaireCanonical && scenario.serviceMode === 'virtual'
      ? { virtualQuestionnaireCanonical: scenario.testQuestionnaireCanonical }
      : scenario.testQuestionnaireCanonical && scenario.serviceMode === 'in-person'
      ? { inPersonQuestionnaireCanonical: scenario.testQuestionnaireCanonical }
      : {};

  const overrides: Partial<BookingConfig> = {
    ...bookingOverrides,
    ...(testLocationName && { defaultWalkinLocationName: testLocationName }),
    ...(shouldClearPrebookRouting && { inPersonPrebookRoutingParams: [] }),
    ...questionnaireCanonicalOverride,
  };

  if (scenario.testQuestionnaireCanonical) {
    console.log('Injecting test questionnaire canonical via booking config:', scenario.testQuestionnaireCanonical);
  }

  // Inject booking config before navigation (must happen before app loads)
  // Note: VALUE_SETS and CONSENT_FORMS are now baked in at deploy time via ottehr-config-overrides
  // Questionnaire canonical is now included in the config overrides above
  await injectTestConfig(page, CONFIG_INJECTION_KEYS.BOOKING, overrides);

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

  // 7. Complete paperwork if required (using scenario's pre-resolved instance config)
  let paperworkHelper: PagedQuestionnaireFlowHelper | undefined;
  if (scenario.resolvedPaperworkConfig) {
    const serviceCategory =
      (scenario.serviceCategory as 'urgent-care' | 'workers-comp' | 'occupational-medicine') || 'urgent-care';
    paperworkHelper = await completePaperwork({
      page,
      serviceMode: scenario.serviceMode,
      visitType: scenario.visitType,
      fillingStrategy: scenario.fillingStrategy,
      serviceCategory,
      resolvedPaperworkConfig: scenario.resolvedPaperworkConfig,
    });
  }

  return { appointmentResponse, paperworkHelper };
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
 * Returns the helper which contains collected responses for enableWhen evaluation
 */
async function completePaperwork(params: CompletePaperworkParams): Promise<PagedQuestionnaireFlowHelper> {
  const { page, serviceMode, visitType, fillingStrategy, serviceCategory, resolvedPaperworkConfig } = params;

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

  return helper;
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
