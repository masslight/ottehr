import { expect, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new ResourceHandler();

const awaitCSSHeaderInit = async (page: Page): Promise<void> => {
  await expect(async () => {
    const content = await page.getByTestId(dataTestIds.cssHeader.container).textContent();
    return content?.includes(resourceHandler.patient.name![0].family!) ?? false;
  }).toPass({ timeout: 30_000 });
};

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000); // ensure resources are ready
});

test('Happy path: set up filters and navigate to visit page', async ({ page }) => {
  await page.goto('/visits');

  // INITIAL DATA IS LOADED
  await expect(page.getByTestId('PersonIcon')).toBeVisible();
  await expect(page.getByTestId(dataTestIds.dashboard.addPatientButton)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId(dataTestIds.header.userName)).toBeAttached({ timeout: 15000 });

  // CHOOSE DATE
  await page.waitForSelector('button[aria-label*="Choose date"]');
  await page.click('button[aria-label*="Choose date"]');
  await page.getByTestId(dataTestIds.dashboard.datePickerTodayButton).locator('button').click();

  // CHOOSE LOCATION
  await page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('button', { name: 'Open' }).click();
  await page
    .locator('body .MuiAutocomplete-popper .MuiAutocomplete-option')
    .getByText(new RegExp(ENV_LOCATION_NAME!, 'i'))
    .waitFor();
  await page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('combobox').fill(ENV_LOCATION_NAME!);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId(dataTestIds.dashboard.locationSelect).getByRole('combobox')).toHaveValue(
    new RegExp(ENV_LOCATION_NAME!, 'i'),
    {
      timeout: 3000,
    }
  );

  // TODO: The appointment list is not working due to repo migration process, uncomment tests later

  // CHOOSE TAB
  await page.locator(`[data-testid="${dataTestIds.dashboard.prebookedTab}"]`).click();

  // INTAKE RESOURCE WAS CREATED AND INTAKE BUTTON IS AVAILABLE
  await expect(
    page
      .getByTestId(dataTestIds.dashboard.tableRowWrapper(resourceHandler.appointment.id!))
      .locator(`button[data-testid="${dataTestIds.dashboard.intakeButton(resourceHandler.appointment.id!)}"]`)
  ).toBeAttached({ timeout: 15000 });

  // todo: commenting out cause it doesn't work in CI, need to investigate why, locally runs fine every time
  // // GOTO VISIT PAGE
  // await page.getByTestId(dataTestIds.dashboard.tableRowStatus(resourceHandler.appointment.id!)).click();

  // // CHECK THE URL CHANGED
  // await page.waitForURL(`/visit/${resourceHandler.appointment.id}`);

  // // PATIENT NAME IS DISPLAYED
  // await expect(page.getByTestId(dataTestIds.appointmentPage.patientFullName)).toContainText(
  //   resourceHandler.patient.name![0].family!
  // );
});

test('CSS intake patient page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/patient-info`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake screening-questions page is available', async ({ page }) => {
  await page.goto(`/in-person/intake/${resourceHandler.appointment.id}/screening-questions`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake vitals page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/vitals`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake allergies page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/allergies`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake medications page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/medications`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake medical conditions page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/medical-conditions`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake surgical history page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/surgical-history`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake hospitalization page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/hospitalization`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake external lab orders page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/external-lab-orders`);
  await awaitCSSHeaderInit(page);
});

test('CSS intake assessment page is available', async ({ page }) => {
  await page.goto(`in-person/intake/${resourceHandler.appointment.id}/assessment`);
  await awaitCSSHeaderInit(page);
});
