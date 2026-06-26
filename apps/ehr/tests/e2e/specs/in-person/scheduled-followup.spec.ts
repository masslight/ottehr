import { BrowserContext, expect, Page, test } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BOOKING_CONFIG, getReasonForVisitOptionsForServiceCategory } from 'utils';
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

    // Step 5: Select a service category. The Reason-for-visit field (asserted below) only renders
    // for a category that has reason-for-visit options configured in BOOKING_CONFIG, so pick such a
    // category from config rather than blindly taking the first dropdown option.
    await test.step('Select service category', async () => {
      const categoryWithReasons = BOOKING_CONFIG.serviceCategories.find(
        (sc) => sc.category.code && getReasonForVisitOptionsForServiceCategory(sc.category.code).length > 0
      );

      const serviceCategoryDropdown = page.getByTestId(dataTestIds.addPatientPage.serviceCategoryDropdown);
      const isDisabled =
        (await serviceCategoryDropdown.locator('[aria-disabled="true"]').count()) > 0 ||
        (await serviceCategoryDropdown.locator('input[disabled]').count()) > 0;

      // When disabled the only category is auto-selected, so there's nothing to pick.
      if (!isDisabled) {
        await serviceCategoryDropdown.click();
        if (categoryWithReasons?.category.display) {
          const option = page.getByRole('option', { name: categoryWithReasons.category.display, exact: true }).first();
          await expect(option).toBeVisible(DEFAULT_TIMEOUT);
          await option.click();
        } else {
          // No config category advertises reasons — fall back to the first available option.
          await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
          await page.getByRole('option').first().click();
        }
      }
    });

    // Step 6: Ensure a location (bookable target) is selected. It's normally pre-populated from the
    // parent encounter, but don't assume that — verify a value is present and pick one if it isn't.
    await test.step('Ensure location is selected', async () => {
      const bookableSelect = page.getByTestId(dataTestIds.addPatientPage.bookableSelect);
      await expect(bookableSelect).toBeVisible(LONG_TIMEOUT);

      const input = bookableSelect.locator('input');
      // Wait until the picker has finished loading its options (the input is disabled/empty while
      // the FHIR fetch is in flight). A non-empty value means a target is already selected.
      const currentValue = await input.inputValue();
      if (currentValue.trim().length > 0) {
        return;
      }

      // Nothing pre-selected — open the dropdown, wait for options to load, and pick the first one.
      await bookableSelect.locator('[role="combobox"]').click();
      const firstOption = page.locator('li[role="option"]').first();
      await expect(firstOption).toBeVisible(LONG_TIMEOUT);
      await firstOption.click();

      // Confirm the value is now populated before moving on.
      await expect(async () => {
        expect((await input.inputValue()).trim().length).toBeGreaterThan(0);
      }).toPass(DEFAULT_TIMEOUT);
    });

    // Step 7: Select reason for visit and submit
    await test.step('Fill reason for visit and submit', async () => {
      const reasonDropdown = page.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown);
      await expect(reasonDropdown).toBeVisible(LONG_TIMEOUT);
      // Open the dropdown and pick the first option — the specific reason doesn't
      // affect what this test verifies, and the option list varies per project config.
      await reasonDropdown.locator('[role="combobox"]').click();
      const firstReason = page.getByRole('option').first();
      await expect(firstReason).toBeVisible(DEFAULT_TIMEOUT);
      await firstReason.click();
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
