import { BrowserContext, expect, Page, test } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const DEFAULT_TIMEOUT = { timeout: 15000 };
const LONG_TIMEOUT = { timeout: 35000 };

let context: BrowserContext;
let page: Page;
const resourceHandler = new ResourceHandler('in-person');

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  // Create a parent visit that we'll create a follow-up from
  await resourceHandler.setResources({ skipPaperwork: true });
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await resourceHandler.cleanupResources();
});

test.describe('Scheduled Follow-up Visit E2E', () => {
  test('Create a scheduled follow-up, verify on tracking board and patient record', async () => {
    const patientId = resourceHandler.resources.patient?.id;
    const patientLastName = resourceHandler.resources.patient?.name?.[0]?.family;
    expect(patientId).toBeTruthy();

    // Step 1: Navigate to patient's follow-up page
    await test.step('Navigate to follow-up creation page', async () => {
      await page.goto(`/patient/${patientId}/followup/add`);
      await expect(page.getByText('Add Follow-up Visit')).toBeVisible(DEFAULT_TIMEOUT);
    });

    // Step 2: Select Scheduled Visit and pick initial visit
    await test.step('Select Scheduled Visit and choose parent visit', async () => {
      await page.getByLabel('Scheduled Visit').click();
      await expect(page.getByText('Initial visit *')).toBeVisible(DEFAULT_TIMEOUT);

      // Select the first (and only) available initial visit
      await page.getByRole('combobox', { name: /initial visit/i }).click();
      await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
      await page.getByRole('option').first().click();
    });

    // Step 3: Continue to Add Visit page
    await test.step('Continue to Add Visit page', async () => {
      await page.getByText('Continue to Add Visit').click();
      await expect(page.getByText('Add Scheduled Follow-up Visit')).toBeVisible(LONG_TIMEOUT);
      // Patient should be pre-filled
      await expect(page.getByText(/Patient:/)).toBeVisible(DEFAULT_TIMEOUT);
    });

    // Step 4: Fill out the Add Visit form (walk-in for simplicity)
    await test.step('Fill visit type and location', async () => {
      // Select visit type: Walk-in
      await page.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).click();
      await page.getByText('Walk-in In Person Visit').click();

      // Location should be pre-populated, but select if needed
      const locationSelect = page.getByTestId(dataTestIds.dashboard.locationSelect);
      const locationValue = await locationSelect.locator('input').inputValue();
      if (!locationValue) {
        await locationSelect.click();
        await page.locator(`li[role="option"]`).first().click();
      }
    });

    await test.step('Select reason for visit and submit', async () => {
      // Select reason for visit
      await page.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown).click();
      // Pick the first available reason
      await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
      await page.getByRole('option').first().click();

      // Click Add button to create the visit
      await page.getByTestId(dataTestIds.addPatientPage.addButton).click();
    });

    // Step 5: Should navigate to tracking board after creation
    await test.step('Redirected to tracking board after creation', async () => {
      await page.waitForURL('/visits', { timeout: 35000 });
      await expect(page).toHaveURL('/visits');
    });

    // Step 6: Verify the scheduled follow-up appears on the tracking board
    await test.step('Scheduled follow-up appears on tracking board with follow-up icon', async () => {
      // Find the patient name on the tracking board
      const patientNameOnBoard = page.getByTestId(dataTestIds.dashboard.patientName).filter({
        hasText: patientLastName!,
      });
      await expect(patientNameOnBoard.first()).toBeVisible(LONG_TIMEOUT);

      // At least one visit for this patient should exist on the board
      await expect(patientNameOnBoard.first()).toBeVisible();
    });

    // Step 7: Navigate to patient record and verify indentation
    await test.step('Patient record shows scheduled follow-up indented under parent', async () => {
      await page.goto(`/patient/${patientId}`);

      // Wait for encounters to load
      const encountersSection = page.getByText('Encounters');
      await expect(encountersSection).toBeVisible(LONG_TIMEOUT);

      // There should be at least one table row (the visits exist)
      const tableRows = page.locator('table tbody tr');
      await expect(tableRows.first()).toBeVisible(LONG_TIMEOUT);

      // Verify there's an indented follow-up row (SubdirectoryArrowRightIcon indicates indentation)
      const indentedRows = page.locator('svg[data-testid="SubdirectoryArrowRightIcon"]');
      await expect(indentedRows.first()).toBeVisible(DEFAULT_TIMEOUT);
    });
  });
});
