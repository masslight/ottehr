import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForGetChartDataResponse } from 'test-utils';
import { ApptTelemedTab, TelemedAppointmentStatusEnum, TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { awaitAppointmentsTableToBeVisible, telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `videoCallFlow.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

test('Should assign visit to practitioner', async () => {
  await page.goto(`telemed/appointments`);
  await awaitAppointmentsTableToBeVisible(page);
  await page
    .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton)
    .click();
  await telemedDialogConfirm(page);
  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
});

test('Should start video call', async () => {
  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible();
  await connectButton.click();

  await telemedDialogConfirm(page);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible();
});

test('Appointment status should be "on-video" during the call', async () => {
  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['on-video']);
});

test('Should end video call and check status "unsigned"', async () => {
  await page.getByTestId(dataTestIds.telemedEhrFlow.endVideoCallButton).click();
  await telemedDialogConfirm(page);
  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['unsigned']);
});

test('Visit should be in "unsigned" tab on the tracking board', async () => {
  await page.goto(`telemed/appointments`);
  await page.getByTestId(dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab['not-signed'])).click();
  await awaitAppointmentsTableToBeVisible(page);
  await expect(
    page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
  ).toBeVisible();
});

test('Should fill all required fields', async () => {
  await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
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
  const confirmationChecked = await patientInfoConfirmationCheckbox.isChecked();
  if (!confirmationChecked) {
    await expect(patientInfoConfirmationCheckbox).toBeVisible();
    await patientInfoConfirmationCheckbox.click();
    await expect(patientInfoConfirmationCheckbox).toBeEnabled();
  }
});

test('Should sign visit', async () => {
  await page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton).click();
  await telemedDialogConfirm(page);

  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['complete']);
});
