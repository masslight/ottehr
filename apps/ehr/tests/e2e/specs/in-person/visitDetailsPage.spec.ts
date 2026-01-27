import { BrowserContext, expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { PATIENT_SSN, ResourceHandler } from 'tests/e2e-utils/resource-handler';
import { PATIENT_RECORD_CONFIG, PdfTestHelper } from 'utils';
import { expectVisitDetailsPage } from '../../page/VisitDetailsPage';

const PROCESS_ID = `visitDetailsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');
const NEW_SSN = '987-65-4321';

// Check if SSN tests should run by verifying the field exists in the form configuration
const shouldRunSsnTests = !PATIENT_RECORD_CONFIG.FormFields.patientSummary.hiddenFields?.includes('patient-ssn');

test.describe('Visit details page', { tag: '@smoke' }, async () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`/visit/${resourceHandler.appointment.id!}`);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources(page);
    await page.close();
    await context.close();
  });

  test.describe.configure({ mode: 'serial' });

  test('should display SSN from pre-paperwork', async () => {
    // Skip test if SSN field is not configured in the patient record form
    test.skip(!shouldRunSsnTests, 'SSN field is not configured in the patient record form');

    const visitDetailsPage = await expectVisitDetailsPage(page, resourceHandler.appointment.id!);

    // Verify SSN is displayed in Visit Details
    await visitDetailsPage.verifySsnDisplayed(PATIENT_SSN);
  });

  test('should allow editing and saving SSN', async () => {
    // Skip test if SSN field is not configured in the patient record form
    test.skip(!shouldRunSsnTests, 'SSN field is not configured in the patient record form');

    const visitDetailsPage = await expectVisitDetailsPage(page, resourceHandler.appointment.id!);

    // Edit SSN field
    await visitDetailsPage.editSsn(NEW_SSN);

    // Save changes
    await visitDetailsPage.clickSaveChanges();

    // Wait for save success notification
    await visitDetailsPage.waitForSaveSuccess();

    // Refresh page to verify SSN was saved
    await page.reload();

    // Verify new SSN is displayed
    await visitDetailsPage.verifySsnDisplayed(NEW_SSN);
  });

  test('should generate Visit Details PDF with SSN', async () => {
    // Skip test if SSN field is not configured in the patient record form
    test.skip(!shouldRunSsnTests, 'SSN field is not configured in the patient record form');

    const pdfHelper = new PdfTestHelper(page);

    // Find the PDF button
    const pdfButton = page.getByRole('button', { name: /visit details pdf/i });
    await expect(pdfButton).toBeEnabled();
    const blobUrl = await pdfHelper.getBlobUrlFromButton(pdfButton);
    const filePath = await pdfHelper.downloadFromBlobUrl(blobUrl, 'visit-details');
    const text = await pdfHelper.extractText(filePath);

    // Log full PDF content for debugging
    console.log('\n========== PDF CONTENT START ==========');
    console.log(text);
    console.log('========== PDF CONTENT END ==========\n');

    // Verify SSN is in the PDF text (with or without dashes)
    const hasSsnWithDashes = text.includes(NEW_SSN);
    const hasSsnWithoutDashes = text.includes(NEW_SSN.replace(/-/g, ''));
    expect(hasSsnWithDashes || hasSsnWithoutDashes).toBeTruthy();

    pdfHelper.cleanup(filePath);
  });
});
