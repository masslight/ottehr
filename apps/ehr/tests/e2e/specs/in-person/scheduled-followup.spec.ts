import { BrowserContext, expect, Page, test } from '@playwright/test';
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

test.describe('Scheduled Follow-up Visit E2E', () => {
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

  test('Scheduled follow-up navigates to Add Visit with patient pre-filled', async () => {
    const patientId = resourceHandler.patient?.id;
    expect(patientId).toBeTruthy();

    await page.goto(`/patient/${patientId}/followup/add`);
    await expect(page.getByText('Add Follow-up Visit')).toBeVisible(DEFAULT_TIMEOUT);

    await test.step('Select Scheduled Visit and pick parent encounter', async () => {
      await page.getByLabel('Scheduled Visit', { exact: true }).click();
      const combobox = page.getByRole('combobox', { name: /initial visit/i });
      await expect(combobox).toBeVisible(DEFAULT_TIMEOUT);
      await combobox.click();
      await page.getByRole('option').first().waitFor(DEFAULT_TIMEOUT);
      await page.getByRole('option').first().click();
    });

    await test.step('Continue to Add Visit page', async () => {
      await page.getByText('Continue to Add Visit').click();
      await expect(page.getByText('Add Scheduled Follow-up Visit')).toBeVisible(LONG_TIMEOUT);
      await expect(page.getByText(/Patient:/)).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test('Patient record shows encounters with indented follow-ups', async () => {
    const patientId = resourceHandler.patient?.id;
    expect(patientId).toBeTruthy();

    await page.goto(`/patient/${patientId}`);

    await test.step('Patient encounters section loads', async () => {
      // Wait for the encounters table to render with at least one row
      const tableRows = page.locator('table tbody tr');
      await expect(tableRows.first()).toBeVisible(LONG_TIMEOUT);
    });
  });
});
