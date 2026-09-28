/**
 * Extended scenario helpers for P1 and P2 coverage
 *
 * These helpers add post-booking behaviors to existing test scenarios:
 *
 * P1 (Critical User Journeys):
 * - Returning patient flow (prefilled data verification)
 * - Reservation modification
 * - Reservation cancellation
 *
 * P2 (Important Features):
 * - Waiting room participant management (virtual only)
 * - Past visits page verification
 * - Review page detailed verification
 */

import { expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  getPrivacyPolicyLinkDefForLocation,
  getTermsAndConditionsLinkDefForLocation,
} from 'utils/lib/ottehr-config/legal';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { CreateAppointmentResponse } from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { PagedQuestionnaireFlowHelper } from '../paperwork/PagedQuestionnaireFlowHelper';
import { BookingFlowHelpers } from './BookingFlowHelpers';
import { BookingTestScenario } from './BookingTestFactory';
import { TEST_FIXTURE_TIMEZONES } from './TestLocationManager';

/**
 * Execute a returning patient flow after an initial booking
 *
 * This starts a NEW booking flow for the same patient that was just created,
 * selects them on the patient selection screen, and verifies the patient
 * information page shows them as a known patient.
 */
export async function executeReturningPatientFlow(
  page: Page,
  scenario: BookingTestScenario,
  initialAppointment: CreateAppointmentResponse
): Promise<void> {
  console.log('\n=== EXTENDED: Returning Patient Flow ===');
  const patientId = initialAppointment.fhirPatientId;
  console.log(`Using patient from initial appointment: ${patientId}`);

  const patientName = initialAppointment.resources.patient.name?.[0];
  const firstName = patientName?.given?.[0];
  const lastName = patientName?.family;
  if (!firstName || !lastName) {
    throw new Error(`Patient ${patientId} from the initial appointment has no first and last name`);
  }

  // Start the second booking the same way as the first
  await BookingFlowHelpers.startBookingFlow(page, scenario.homepageOptionLabel);
  if (scenario.serviceCategory) {
    await BookingFlowHelpers.selectServiceCategoryIfNeeded(
      page,
      scenario.resolvedConfig,
      scenario.serviceCategory,
      scenario.visitType,
      scenario.serviceMode
    );
  }

  // The patient selection screen lists the patient the initial booking created
  await page.locator(`input[type="radio"][value="${patientId}"]`).check();
  console.log('Selected the existing patient');
  await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after patient selection');

  // The initial walk-in is already checked in, so there is nothing to check in to and the new
  // walk-in continues to patient information, which shows the known patient instead of name inputs
  await page.waitForURL(/\/patient-information/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: new RegExp(`^${firstName}\\b.*\\b${lastName}$`) })).toBeVisible();
  console.log(`✓ Patient information shows known patient ${firstName} ${lastName}`);

  console.log('✓ Returning patient flow completed successfully');
}

/**
 * Execute reservation modification flow after a prebook appointment
 *
 * Navigates to the appointment confirmation page and modifies the time slot.
 * Selects a slot at least 30 minutes in the future to avoid timing flakes.
 */
export async function executeModificationFlow(
  page: Page,
  appointmentResponse: CreateAppointmentResponse
): Promise<void> {
  console.log('\n=== EXTENDED: Reservation Modification Flow ===');
  console.log(`Modifying appointment: ${appointmentResponse.appointmentId}`);

  // Navigate to the visit confirmation page (ThankYou.tsx)
  await page.goto(`/visit/${appointmentResponse.appointmentId}`, { waitUntil: 'networkidle' });
  console.log('Navigated to visit confirmation page');

  // Click the Modify button
  const modifyButton = page.getByRole('button', { name: /modify/i });
  await modifyButton.click();
  console.log('Clicked Modify button');

  // Wait for reschedule page
  await page.waitForURL(/\/reschedule/, { timeout: 20000 });
  console.log('On reschedule page');

  // Verify "First available time" text is visible
  await expect(page.getByText('First available time')).toBeVisible({ timeout: 20000 });
  console.log('Time slot selection is visible');

  // Use shared utility to find and click a suitable time slot
  // Skip the first 2 slots to avoid selecting the current appointment's slot
  // (which may be in the past or very soon).
  // Modification only runs on the prebook-in-person scenario (see
  // shouldExtendWithModification) → fixture TZ is always inPerson.
  const { timeText: newTimeText } = await BookingFlowHelpers.findAndClickSuitableTimeSlot(
    page,
    TEST_FIXTURE_TIMEZONES.inPerson,
    30,
    { skipFirstN: 2 }
  );

  // Click the "Modify to [date/time]" button to confirm the new time
  const submitButton = page.getByRole('button', { name: /^Modify to /i });
  await submitButton.click();
  console.log('Submitted new time selection');

  // Wait for confirmation and verify the new time is shown
  await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20000 });

  // Verify the new time appears on the confirmation page. The word boundaries keep "2:00 PM" from
  // matching "12:00 PM".
  const timeBlock = page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock);
  await expect(timeBlock).toContainText(new RegExp(`\\b${newTimeText.trim()}\\b`), { timeout: 20000 });
  console.log(`✓ New time "${newTimeText.trim()}" is displayed on confirmation page`);

  console.log('✓ Reservation modification completed successfully');
}

/**
 * Execute reservation cancellation flow after a prebook appointment
 *
 * Navigates to the appointment confirmation page, cancels the visit,
 * and verifies the Book Again flow.
 */
export async function executeCancellationFlow(
  page: Page,
  appointmentResponse: CreateAppointmentResponse,
  scenario: BookingTestScenario
): Promise<void> {
  const { serviceMode, resolvedConfig } = scenario;
  console.log('\n=== EXTENDED: Reservation Cancellation Flow ===');
  console.log(`Canceling appointment: ${appointmentResponse.appointmentId}`);

  // Navigate to the visit confirmation page
  await page.goto(`/visit/${appointmentResponse.appointmentId}`, { waitUntil: 'networkidle' });
  console.log('Navigated to visit confirmation page');

  // Click the Cancel button
  const cancelButton = page.getByRole('button', { name: /cancel/i });
  await cancelButton.click();
  console.log('Clicked Cancel button');

  // Wait for cancel page
  await page.waitForURL(/\/cancel/, { timeout: 20000 });
  console.log('On cancellation page');

  // Verify cancellation heading is visible
  await expect(page.getByRole('heading', { name: /cancel/i })).toBeVisible({ timeout: 20000 });

  // Select a cancellation reason
  const cancelReasonOptions =
    serviceMode === 'in-person'
      ? VALUE_SETS.cancelReasonOptionsInPersonPatient
      : VALUE_SETS.cancelReasonOptionsVirtualPatient;

  const reasonField = page.locator('#cancellationReason');
  await reasonField.click();
  console.log('Opened cancellation reason dropdown');

  // Select the first available reason
  const firstReason = cancelReasonOptions[0];
  await page.getByRole('option', { name: firstReason.label }).click();
  console.log(`Selected cancellation reason: ${firstReason.label}`);

  // Click the Cancel Visit button to confirm
  const confirmCancelButton = page.getByRole('button', { name: /cancel visit/i });
  await confirmCancelButton.click();
  console.log('Confirmed cancellation');

  // Wait for cancellation confirmation page
  await page.waitForURL(/\/cancellation-confirmation/, { timeout: 20000 });
  console.log('On cancellation confirmation page');

  // Verify cancellation confirmation heading ("Your visit has been canceled")
  await expect(page.getByRole('heading', { name: /your visit has been canceled/i })).toBeVisible({ timeout: 20000 });
  console.log('✓ Cancellation confirmed');

  // Test Book Again flow
  const bookAgainButton = page.getByRole('button', { name: /book again/i });
  await bookAgainButton.click();
  console.log('Clicked Book Again button');

  // Verify we're back on the homepage
  await page.waitForURL(/\/home/, { timeout: 20000 });
  // Verify a booking button from the config is visible
  const firstHomepageOption = resolvedConfig.homepageOptions[0];
  await expect(page.getByRole('button', { name: firstHomepageOption.label })).toBeVisible({ timeout: 20000 });
  console.log('✓ Returned to homepage via Book Again');

  console.log('✓ Reservation cancellation flow completed successfully');
}

/**
 * Determine if a scenario should include returning patient flow extension
 */
export function shouldExtendWithReturningPatient(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the first in-person walk-in scenario for each config type
  const inPersonWalkins = allScenarios.filter(
    (s) => s.visitType === 'walk-in' && s.serviceMode === 'in-person' && s.configName === scenario.configName
  );

  return inPersonWalkins.length > 0 && inPersonWalkins[0] === scenario;
}

/**
 * Determine if a scenario should include modification flow extension
 */
export function shouldExtendWithModification(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the first in-person prebook scenario
  // Only in-person prebooks reliably show Modify button on visit confirmation page
  const inPersonPrebooks = allScenarios.filter(
    (s) => s.visitType === 'prebook' && s.serviceMode === 'in-person' && s.configName === scenario.configName
  );

  return inPersonPrebooks.length > 0 && inPersonPrebooks[0] === scenario;
}

/**
 * Determine if a scenario should include cancellation flow extension
 */
export function shouldExtendWithCancellation(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the second in-person prebook scenario (if exists)
  // Only in-person prebooks reliably show Cancel button on visit confirmation page
  const inPersonPrebooks = allScenarios.filter(
    (s) => s.visitType === 'prebook' && s.serviceMode === 'in-person' && s.configName === scenario.configName
  );

  return inPersonPrebooks.length > 1 && inPersonPrebooks[1] === scenario;
}

// =============================================================================
// P2: Important Features
// =============================================================================

/**
 * Execute waiting room participant management flow after a virtual walk-in appointment
 *
 * Tests inviting a participant by phone and verifying they appear in the invitee list.
 */
export async function executeWaitingRoomParticipantsFlow(page: Page): Promise<void> {
  console.log('\n=== EXTENDED: Waiting Room Participant Management ===');

  // Should already be on waiting room page after virtual walk-in completion
  await expect(page.getByTestId('flow-page-title')).toHaveText('Waiting room', { timeout: 20000 });
  console.log('On waiting room page');

  // Click "Manage participants" button
  const manageButton = page.getByText('Manage participants');
  await manageButton.click();
  console.log('Clicked Manage participants');

  // Wait for invite modal to appear
  await expect(page.getByText('Invite participant')).toBeVisible({ timeout: 10000 });
  console.log('Invite participant modal opened');

  // Fill in invitee details
  const testFirstName = 'TestInvitee';
  const testLastName = 'Person';
  const testPhone = '5551234567';

  await page.locator('#firstName').fill(testFirstName);
  await page.locator('#lastName').fill(testLastName);

  // Select Phone as contact method (radio button)
  await page.locator("input[value='Phone' i]").check();
  console.log('Selected Phone as contact method');

  await page.locator('#phoneNumber').fill(testPhone);
  console.log(`Filled invitee details: ${testFirstName} ${testLastName}, phone: ${testPhone}`);

  // Click Send invite
  const sendButton = page.getByRole('button', { name: 'Send invite' });
  await sendButton.click();
  console.log('Clicked Send invite');

  // Verify invitee appears in the list
  const inviteeFullName = `${testFirstName} ${testLastName}`;
  const inviteeList = page.getByTestId('manage-participants');
  await expect(inviteeList).toContainText(inviteeFullName, { timeout: 10000 });
  console.log(`✓ Invitee "${inviteeFullName}" appears in participant list`);

  // Test cancel invite flow
  await page.getByRole('button', { name: new RegExp(`Manage participants.*${inviteeFullName}`, 'i') }).click();
  console.log('Opened manage modal for invitee');

  // Click Cancel invite
  const cancelButton = page.getByRole('button', { name: 'Cancel invite' });
  await cancelButton.click();
  console.log('Clicked Cancel invite');

  // Confirm cancellation dialog appears
  await expect(page.getByText(/are you sure you want to cancel invite/i)).toBeVisible({ timeout: 5000 });

  // Confirm cancellation
  await cancelButton.click();
  console.log('Confirmed cancel invite');

  // Verify invitee is removed
  await expect(inviteeList).toContainText('No invited participants', { timeout: 10000 });
  console.log('✓ Invitee removed from list');

  console.log('✓ Waiting room participant management completed successfully');
}

/**
 * Determine if a scenario should include waiting room participants flow extension
 */
export function shouldExtendWithWaitingRoomParticipants(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the first virtual walk-in scenario per config
  const virtualWalkins = allScenarios.filter(
    (s) => s.visitType === 'walk-in' && s.serviceMode === 'virtual' && s.configName === scenario.configName
  );

  return virtualWalkins.length > 0 && virtualWalkins[0] === scenario;
}

/**
 * Execute past visits page verification after an appointment
 *
 * Navigates to the patient's past visits. Past visits lists fulfilled and cancelled appointments
 * only, so the scenario's appointment is expected there only once it has been cancelled.
 */
export async function executePastVisitsFlow(
  page: Page,
  appointmentResponse: CreateAppointmentResponse,
  { cancelled }: { cancelled: boolean }
): Promise<void> {
  const { appointmentId, fhirPatientId } = appointmentResponse;
  console.log('\n=== EXTENDED: Past Visits Page Verification ===');
  console.log(`Verifying appointment ${appointmentId} is ${cancelled ? '' : 'not '}listed in past visits`);

  // Navigate to homepage
  await page.goto('/home', { waitUntil: 'networkidle' });
  console.log('Navigated to homepage');

  // Click Past Visits button
  const pastVisitsButton = page.getByTestId(dataTestIds.navigatePastVisitsButton);
  await pastVisitsButton.click();
  console.log('Clicked Past Visits button');

  // Wait for patient selection page to load (my-patients)
  await page.waitForURL(/\/my-patients/, { timeout: 20000 });
  console.log('On patient selection page');

  // Select the patient this scenario booked for
  await page.locator(`input[type="radio"][value="${fhirPatientId}"]`).check();
  console.log('Selected test patient');

  // Click Continue to go to past visits
  await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after patient selection');

  // Wait for past visits page to load - route is /my-patients/:patientId/past-visits
  await page.waitForURL(new RegExp(`/my-patients/${fhirPatientId}/past-visits`), { timeout: 20000 });
  console.log('On past visits page');

  // Verify the page heading (page title is "Visits")
  await expect(page.getByRole('heading', { name: /visits/i })).toBeVisible({ timeout: 10000 });

  // The list or its empty state renders once the visits have loaded
  const visitsLoaded = page.getByTestId('empty-state-message').or(page.getByTestId('past-visits-list'));
  await expect(visitsLoaded.first()).toBeVisible({ timeout: 20000 });

  const visitIdText = page.getByText(`Visit ID: ${appointmentId}`);
  if (cancelled) {
    await expect(visitIdText).toBeVisible();
    console.log(`✓ Cancelled appointment ${appointmentId} found in past visits`);
  } else {
    await expect(visitIdText).toHaveCount(0);
    console.log(`✓ Upcoming appointment ${appointmentId} not listed in past visits`);
  }

  // Verify back to homepage navigation - use the specific test ID from legacy tests
  const backButton = page.getByTestId('back-to-homepage-button');
  await backButton.click();
  console.log('Clicked back to homepage button');

  await page.waitForURL(/\/home/, { timeout: 10000 });
  console.log('✓ Returned to homepage');

  console.log('✓ Past visits flow completed successfully');
}

/**
 * Determine if a scenario should include past visits flow extension
 */
export function shouldExtendWithPastVisits(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the third prebook scenario (if exists) or second in-person walk-in
  const prebooks = allScenarios.filter((s) => s.visitType === 'prebook' && s.configName === scenario.configName);
  if (prebooks.length > 2 && prebooks[2] === scenario) {
    return true;
  }

  // Fallback: second in-person walk-in
  const inPersonWalkins = allScenarios.filter(
    (s) => s.visitType === 'walk-in' && s.serviceMode === 'in-person' && s.configName === scenario.configName
  );
  return inPersonWalkins.length > 1 && inPersonWalkins[1] === scenario;
}

/**
 * Execute review page verification after paperwork completion
 *
 * Verifies chip status and edit button navigation on the review page.
 * This should be called BEFORE the final submit on the review page.
 *
 * Config-aware: Uses the paperworkHelper's getVisiblePages() which evaluates
 * enableWhen conditions against collected responses to determine visible sections.
 */
export async function executeReviewPageVerification(
  page: Page,
  appointmentId: string,
  _serviceMode: 'in-person' | 'virtual',
  paperworkHelper?: PagedQuestionnaireFlowHelper
): Promise<void> {
  console.log('\n=== EXTENDED: Review Page Verification ===');

  // Navigate directly to review page
  await page.goto(`/paperwork/${appointmentId}/review`, { waitUntil: 'networkidle' });
  console.log('Navigated to review page');

  // Verify review page heading
  await expect(page.getByRole('heading', { name: /review and submit/i })).toBeVisible({ timeout: 20000 });
  console.log('Review and submit heading visible');

  // Check patient name is displayed
  const patientName = page.getByTestId(dataTestIds.patientNamePaperworkReviewScreen);
  await expect(patientName).toBeVisible();
  console.log('✓ Patient name displayed');

  // Check location name is displayed
  const locationName = page.getByTestId(dataTestIds.locationNamePaperworkReviewScreen);
  await expect(locationName).toBeVisible();
  console.log('✓ Location name displayed');

  // Get visible sections using enableWhen evaluation against collected responses
  // This properly handles dynamic visibility based on QuestionnaireResponse answers
  let visibleSections: string[] = [];
  if (paperworkHelper) {
    const visiblePages = paperworkHelper.getVisiblePages();
    visibleSections = visiblePages.map((p) => p.linkId);
    console.log(`Visible sections (evaluated from collected responses): ${visibleSections.join(', ')}`);
  } else {
    console.log('Warning: No paperworkHelper provided, skipping section verification');
  }

  // Verify chip statuses for visible sections
  for (const sectionId of visibleSections.slice(0, 3)) {
    // Check up to 3 sections
    const chipLocator = page.locator(`[data-testid="${sectionId}-status"] div`);
    await expect(chipLocator).toBeVisible();
    const status = await chipLocator.getAttribute('data-testid');
    console.log(`${sectionId} status: ${status}`);
  }

  // Verify legal texts (privacy policy and terms & conditions links)
  await verifyLegalTexts(page, 'PAPERWORK_REVIEW_PAGE');

  // Test edit button navigation - use first visible section that has an edit button
  const firstEditableSection = visibleSections[0] || 'contact-information-page';
  const editButton = page.getByTestId(`${firstEditableSection}-edit`);
  await editButton.click();
  console.log(`Clicked ${firstEditableSection} edit button`);

  // Wait for navigation away from review page
  await page.waitForURL((url) => !url.pathname.includes('/review'), { timeout: 10000 });
  console.log(`✓ Edit button navigated away from review page`);

  // Navigate back to review
  await page.goBack({ waitUntil: 'load' });
  console.log('Navigated back');

  // Verify we're back on review page
  await expect(page.getByRole('heading', { name: /review and submit/i })).toBeVisible({ timeout: 10000 });
  console.log('✓ Back button returned to Review page');

  // Verify Continue button is present
  const continueButton = page.getByTestId(dataTestIds.continueButton);
  await expect(continueButton).toBeVisible();
  console.log('✓ Continue button visible');

  console.log('✓ Review page verification completed successfully');
}

/**
 * Verify legal texts (privacy policy and terms & conditions) on a page
 *
 * Based on the legal config, verifies that:
 * - If link definition exists: link is visible and opens a PDF
 * - If link definition is undefined: link is not visible
 *
 * Page IDs:
 * - 'PAPERWORK_REVIEW_PAGE': Used on /paperwork/{id}/review (ReviewPaperwork.tsx)
 * - 'REVIEW_PAGE': Used on /slot/{slotId}/review during booking flow (Review.tsx)
 *
 * Note: The visit confirmation page (/visit/{id}, ThankYou.tsx) does NOT have legal texts.
 *
 * @param page Playwright page object
 * @param pageId The legal config page ID (e.g., 'PAPERWORK_REVIEW_PAGE', 'REVIEW_PAGE')
 */
/**
 * Check if a PDF file exists in the public folder.
 * Throws a descriptive error if the file is missing (misconfiguration).
 */
function assertPdfFileExists(pdfUrl: string, linkType: string): void {
  // PDF URLs are relative to public folder, e.g., "/Privacy Policy.pdf" or "/template.pdf"
  // Remove leading slash to get the filename
  const filename = pdfUrl.startsWith('/') ? pdfUrl.slice(1) : pdfUrl;

  // Resolve path relative to the intake app's public folder
  // Tests run from apps/intake, so public folder is at ./public
  const publicFolderPath = path.resolve(__dirname, '../../../public');
  const pdfFilePath = path.join(publicFolderPath, filename);

  if (!fs.existsSync(pdfFilePath)) {
    throw new Error(
      `MISCONFIGURATION: ${linkType} PDF file is missing!\n` +
        `  Config URL: ${pdfUrl}\n` +
        `  Expected file: ${pdfFilePath}\n` +
        `  This will break production. Please add the PDF file to the public folder.`
    );
  }

  console.log(`✓ PDF file exists: ${pdfFilePath}`);
}

export async function verifyLegalTexts(page: Page, pageId: string): Promise<void> {
  console.log(`\n--- Verifying legal texts for ${pageId} ---`);

  // Verify privacy policy link
  const privacyLinkDef = getPrivacyPolicyLinkDefForLocation(pageId);
  if (privacyLinkDef === undefined) {
    // Config says no privacy policy - verify it's not visible
    const privacyLink = page.locator('[data-testid="privacy-policy-review-screen"]');
    await expect(privacyLink).not.toBeVisible({ timeout: 2000 });
    console.log('✓ Privacy policy link correctly not visible (config undefined)');
  } else {
    // Config says privacy policy should exist - verify it's visible and opens PDF
    console.log(`Privacy policy config: testId="${privacyLinkDef.testId}", url="${privacyLinkDef.url}"`);

    // First, verify the PDF file exists in the public folder
    assertPdfFileExists(privacyLinkDef.url, 'Privacy Policy');

    const privacyLink = page.locator(`[data-testid="${privacyLinkDef.testId}"]`);
    await expect(privacyLink).toBeVisible({ timeout: 5000 });
    console.log(`✓ Privacy policy link visible (testId: ${privacyLinkDef.testId})`);

    // Verify the link opens a PDF by checking for download event
    console.log(`Clicking privacy policy link to verify PDF download from: ${privacyLinkDef.url}`);
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await privacyLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    console.log(`✓ Privacy policy link opens PDF: ${download.suggestedFilename()}`);
  }

  // Verify terms and conditions link
  const termsLinkDef = getTermsAndConditionsLinkDefForLocation(pageId);
  if (termsLinkDef === undefined) {
    // Config says no terms and conditions - verify it's not visible
    const termsLink = page.locator('[data-testid="terms-conditions-review-screen"]');
    await expect(termsLink).not.toBeVisible({ timeout: 2000 });
    console.log('✓ Terms and conditions link correctly not visible (config undefined)');
  } else {
    // Config says terms and conditions should exist - verify it's visible and opens PDF
    console.log(`Terms and conditions config: testId="${termsLinkDef.testId}", url="${termsLinkDef.url}"`);

    // First, verify the PDF file exists in the public folder
    assertPdfFileExists(termsLinkDef.url, 'Terms and Conditions');

    const termsLink = page.locator(`[data-testid="${termsLinkDef.testId}"]`);
    await expect(termsLink).toBeVisible({ timeout: 5000 });
    console.log(`✓ Terms and conditions link visible (testId: ${termsLinkDef.testId})`);

    // Verify the link opens a PDF by checking for download event
    console.log(`Clicking terms and conditions link to verify PDF download from: ${termsLinkDef.url}`);
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await termsLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    console.log(`✓ Terms and conditions link opens PDF: ${download.suggestedFilename()}`);
  }

  console.log('--- Legal texts verification complete ---\n');
}

/**
 * Determine if a scenario should include review page verification extension
 */
export function shouldExtendWithReviewPageVerification(
  scenario: BookingTestScenario,
  allScenarios: BookingTestScenario[]
): boolean {
  // Extend the fourth prebook scenario (if exists) or second virtual walk-in
  const prebooks = allScenarios.filter((s) => s.visitType === 'prebook' && s.configName === scenario.configName);
  if (prebooks.length > 3 && prebooks[3] === scenario) {
    return true;
  }

  // Fallback: second virtual walk-in
  const virtualWalkins = allScenarios.filter(
    (s) => s.visitType === 'walk-in' && s.serviceMode === 'virtual' && s.configName === scenario.configName
  );
  return virtualWalkins.length > 1 && virtualWalkins[1] === scenario;
}
