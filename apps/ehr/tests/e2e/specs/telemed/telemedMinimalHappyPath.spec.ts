import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForGetChartDataResponse, waitForSaveChartDataResponse } from 'test-utils';
import { isTelemedEnabled } from 'test-utils';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { openVisitsPage } from 'tests/e2e/page/VisitsPage';
import { TelemedAppointmentStatusEnum, TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `videoCallFlow.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources({ skipPaperwork: true });
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

// Skip telemed tests if virtual locations are not configured
test.skip(!isTelemedEnabled, 'Telemed tests require virtual locations to be configured');

test('Should start video call', async () => {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(resourceHandler.appointmentLocation?.name ?? 'Unknown');

  await page.goto(`/in-person/${resourceHandler.appointment.id}`);
  const header = new InPersonHeader(page);
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  await header.selectIntakePractitioner(testUserPractitioner.id);

  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible();
  await connectButton.click();

  await telemedDialogConfirm(page);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible();
});

test.skip('Should fill all required fields', async () => {
  await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);

  await page
    .getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes)
    .locator('textarea')
    .first()
    .fill('patient reports a fever');
  await waitForSaveChartDataResponse(page);

  await page
    .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.assessment))
    .click();

  const diagnosisAutocomplete = page.getByTestId(dataTestIds.diagnosisContainer.diagnosisDropdown);
  await expect(diagnosisAutocomplete).toBeVisible();
  await diagnosisAutocomplete.click();
  await diagnosisAutocomplete.locator('input').fill('fever');
  // Wait for dropdown options to appear
  let dropdownOptions = page.getByRole('option');
  await dropdownOptions.first().waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(diagnosisAutocomplete.locator('input')).toBeEnabled();

  // Wait for delete button to be enabled (indicates diagnosis is fully saved with resourceId)
  await expect(page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton)).toBeEnabled();

  const emAutocomplete = page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown);
  await expect(emAutocomplete).toBeVisible();
  await emAutocomplete.click();
  await emAutocomplete.locator('input').fill('1');
  dropdownOptions = page.getByRole('option');
  await dropdownOptions.first().waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(emAutocomplete.locator('input')).toBeEnabled();

  await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();

  await waitForGetChartDataResponse(page, (json) => !!json.prescribedMedications);

  const patientInfoConfirmationCheckbox = page.getByTestId(dataTestIds.telemedEhrFlow.patientInfoConfirmationCheckbox);
  await expect(patientInfoConfirmationCheckbox).toBeVisible();
  await expect(patientInfoConfirmationCheckbox).toBeEnabled();
  const confirmationChecked = await patientInfoConfirmationCheckbox.isChecked();
  if (!confirmationChecked) {
    await patientInfoConfirmationCheckbox.click();
    await expect(patientInfoConfirmationCheckbox).toBeEnabled();
    await expect(patientInfoConfirmationCheckbox).toBeChecked();
  }
});

test.skip('Should sign visit', async () => {
  // Wait for the review and sign button to become enabled
  await expect(page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeEnabled({ timeout: 60000 });

  await page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton).click();
  await telemedDialogConfirm(page);

  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['complete']);
});
