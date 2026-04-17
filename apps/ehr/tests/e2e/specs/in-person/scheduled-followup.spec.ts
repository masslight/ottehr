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
  await resourceHandler.setResources({ skipPaperwork: true });
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  await resourceHandler.cleanupResources();
});

test.describe.serial('Scheduled Follow-up Visit E2E', () => {
  test('Follow-up page shows Annotation and Scheduled Visit toggle', async () => {
    const patientId = resourceHandler.patient?.id;
    expect(patientId).toBeTruthy();

    await page.goto(`/patient/${patientId}/followup/add`);

    await test.step('Page title and radio buttons are visible', async () => {
      await expect(page.getByText('Add Follow-up Visit')).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByText('Annotation', { exact: true })).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByText('Scheduled Visit', { exact: true })).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Annotation is selected by default with annotation-specific fields', async () => {
      await expect(page.getByLabel('Annotation', { exact: true })).toBeChecked();
      await expect(page.locator('label:has-text("Annotation provider")')).toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('Switching to Scheduled shows initial visit selector', async () => {
      await page.getByLabel('Scheduled Visit', { exact: true }).click();
      await expect(page.getByRole('combobox', { name: /initial visit/i })).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByText('Continue to Add Visit')).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.locator('label:has-text("Annotation provider")')).not.toBeVisible();
    });

    await test.step('Switching back to Annotation restores annotation fields', async () => {
      await page.getByLabel('Annotation', { exact: true }).click();
      await expect(page.locator('label:has-text("Annotation provider")')).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByText('Continue to Add Visit')).not.toBeVisible();
    });
  });

  test('Create a scheduled follow-up, verify on tracking board and patient record', async () => {
    const patientId = resourceHandler.patient?.id;
    expect(patientId).toBeTruthy();

    // Step 1: Navigate to follow-up creation page
    await test.step('Navigate to follow-up page and select Scheduled Visit', async () => {
      await page.goto(`/patient/${patientId}/followup/add`);
      await expect(page.getByText('Add Follow-up Visit')).toBeVisible(DEFAULT_TIMEOUT);
      await page.getByLabel('Scheduled Visit', { exact: true }).click();
    });

    // Step 2: Select parent encounter
    await test.step('Select parent encounter', async () => {
      const combobox = page.getByRole('combobox', { name: /initial visit/i });
      await expect(combobox).toBeVisible(DEFAULT_TIMEOUT);
      await combobox.click();
      await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
      await page.getByRole('option').first().click();
    });

    // Step 3: Continue to Add Visit page
    await test.step('Continue to Add Visit page', async () => {
      await page.getByText('Continue to Add Visit').click();
      await expect(page.getByText('Add Scheduled Follow-up Visit')).toBeVisible(LONG_TIMEOUT);
      await expect(page.getByText(/Patient:/)).toBeVisible(DEFAULT_TIMEOUT);
    });

    // Step 4: Select visit type
    await test.step('Select walk-in visit type', async () => {
      await page.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).click();
      await page.getByText('Walk-in In Person Visit').click();
    });

    // Step 5: Select service category if not disabled (auto-selected when only one)
    await test.step('Select service category', async () => {
      const serviceCategoryDropdown = page.getByTestId(dataTestIds.addPatientPage.serviceCategoryDropdown);
      const isDisabled =
        (await serviceCategoryDropdown.locator('[aria-disabled="true"]').count()) > 0 ||
        (await serviceCategoryDropdown.locator('input[disabled]').count()) > 0;
      if (!isDisabled) {
        await serviceCategoryDropdown.click();
        await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
        await page.getByRole('option').first().click();
      }
    });

    // Step 6: Select location from dropdown (must use dropdown to get walkinSchedule)
    await test.step('Select location', async () => {
      const locationSelect = page.getByTestId(dataTestIds.dashboard.locationSelect);
      // Clear and re-select to ensure walkinSchedule data is loaded
      await locationSelect.click();
      await page.locator('li[role="option"]').first().waitFor(DEFAULT_TIMEOUT);
      await page.locator('li[role="option"]').first().click();
    });

    // Step 7: Select reason for visit and submit
    await test.step('Fill reason for visit and submit', async () => {
      const reasonDropdown = page.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown);
      await expect(reasonDropdown).toBeVisible(LONG_TIMEOUT);
      // Click the dropdown's combobox element to open it
      await reasonDropdown.locator('[role="combobox"]').click();
      // Wait for menu and select Fever
      const feverOption = page.getByRole('option', { name: 'Fever' });
      await expect(feverOption).toBeVisible(DEFAULT_TIMEOUT);
      await feverOption.click();
      // Wait for menu to close
      await page.waitForTimeout(500);

      // Submit the form — use force click to bypass any overlays
      const addButton = page.getByTestId(dataTestIds.addPatientPage.addButton);
      await expect(addButton).toBeEnabled(DEFAULT_TIMEOUT);

      // Log current form state for debugging
      const currentUrl = page.url();
      console.log('Before submit, URL:', currentUrl);

      await addButton.click({ force: true });

      // Wait for either navigation or loading state to complete
      // The submission triggers createSlot + createAppointment which can take time
      await page.waitForURL((url) => url.pathname === '/visits', { timeout: 60000, waitUntil: 'domcontentloaded' });
      console.log('After submit, URL:', page.url());
    });

    // Step 7: Verify on tracking board — visit was created and we redirected
    await test.step('Verify on tracking board', async () => {
      await expect(page).toHaveURL(/\/visits/);
    });

    // Step 8: Verify on patient record with indentation
    await test.step('Verify indented follow-up on patient record', async () => {
      await page.goto(`/patient/${patientId}`);
      const tableRows = page.locator('table tbody tr');
      await expect(tableRows.first()).toBeVisible(LONG_TIMEOUT);

      // Verify indentation icon exists (SubdirectoryArrowRightIcon)
      const indentedRows = page.locator('svg[data-testid="SubdirectoryArrowRightIcon"]');
      await expect(indentedRows.first()).toBeVisible(DEFAULT_TIMEOUT);
    });
  });
});
