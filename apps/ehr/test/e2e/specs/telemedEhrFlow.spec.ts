import { expect, Locator, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { TelemedFlowResourceHandler } from '../../e2e-utils/resource-handlers/telemed-flow-rh';
import { ADDITIONAL_QUESTIONS, TelemedAppointmentStatusEnum } from '../../e2e-utils/temp-imports-from-utils';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new TelemedFlowResourceHandler();
const DEFAULT_TIMEOUT = { timeout: 15000 };

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000); // ensure resources are ready
});

async function iterateThroughTable(tableLocator: Locator, callback: (row: Locator) => Promise<void>): Promise<void> {
  const rows = tableLocator.locator('tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    await callback(rows.nth(i));
  }
}

async function awaitAppointments(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable)).toBeVisible(DEFAULT_TIMEOUT);
  await expect(page.getByTestId(dataTestIds.dashboard.loadingIndicator)).not.toBeVisible(DEFAULT_TIMEOUT);
}

test("Checking my appointment appearing in 'my patients' tab and other appointment in 'all patients' tab.", async ({
  page,
}) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.locator('table');
  let foundMyAppointment = false;
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText?.includes(resourceHandler.myAppointment.appointment.id!)) {
      foundMyAppointment = true;
    }
  });
  expect(foundMyAppointment).toBe(true);

  await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
  await awaitAppointments(page);

  let foundOtherAppointment = false;
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText?.includes(resourceHandler.otherAppointment.appointment.id!)) {
      foundOtherAppointment = true;
    }
  });
  expect(foundOtherAppointment).toBe(true);
});

test('Checking appointment has correct location label and is in a relevant location group', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.locator('table');
  let foundMyLocationGroup = false;
  let foundMyAppointment = false;
  await iterateThroughTable(table, async (row) => {
    if (foundMyAppointment) return;
    const rowText = await row.innerText(DEFAULT_TIMEOUT);

    // THIS IS EXIT FROM OUR FOUND LOCATION GROUP
    // todo is it ok to use enum here like this??
    if (foundMyLocationGroup && !rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready))
      foundMyLocationGroup = false;
    // WE FOUND OUR LOCATION GROUP AND WE ENTERING IT FROM THIS ITERATION
    if (rowText.includes(resourceHandler.myLocationPackage.fullName)) foundMyLocationGroup = true;
    // HERE WE CHECK IF WE FOUND OUR LOCATION GROUP AND OUR APPOINTMENT IS IN THERE
    if (
      foundMyLocationGroup &&
      rowText?.includes(resourceHandler.myAppointment.appointment.id!) &&
      rowText.includes(resourceHandler.myLocationPackage.state)
    ) {
      foundMyAppointment = true;
    }
  });
  expect(foundMyAppointment && foundMyLocationGroup).toBe(true);
});

test('Checking all appointments in my-patients section has appropriate assign buttons', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.locator('table');
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready)) {
      await expect(row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton)).toBeVisible(DEFAULT_TIMEOUT);
    }
  });
});

test('Checking appointment in all-patients section has view button and it leads to view patient chart', async ({
  page,
}) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
  await awaitAppointments(page);

  const table = page.locator('table');
  let otherAppointmentViewButton: Locator | undefined;
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText?.includes(resourceHandler.otherAppointment.appointment.id!)) {
      otherAppointmentViewButton = row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardViewButton);
    }
  });
  expect(otherAppointmentViewButton).toBeDefined();
  await otherAppointmentViewButton?.click(DEFAULT_TIMEOUT);
  const footer = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter);
  await expect(footer).toBeVisible(DEFAULT_TIMEOUT);
  await expect(footer.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe)).not.toBeVisible();
});

test('Assign appointment to me and open it, check status and connect-to-patient button', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.locator('table');
  let myAppointmentAssignButton: Locator | undefined;
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText?.includes(resourceHandler.myAppointment.appointment.id!)) {
      myAppointmentAssignButton = row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton);
    }
  });
  expect(myAppointmentAssignButton).toBeDefined();
  await myAppointmentAssignButton?.click(DEFAULT_TIMEOUT);

  const dialogButtonConfirm = page.getByTestId(dataTestIds.telemedEhrFlow.dialogButtonConfirm);
  await expect(dialogButtonConfirm).toBeVisible(DEFAULT_TIMEOUT);
  await dialogButtonConfirm.click(DEFAULT_TIMEOUT);

  const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
  await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
  // todo: is it ok to have check like this that rely on status text??
  await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(DEFAULT_TIMEOUT);
});

async function fillWaitAndSelectDropdown(page: Page, dropdownDataTestId: string, textToFill: string): Promise<void> {
  // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).click(DEFAULT_TIMEOUT);
  await page.getByTestId(dropdownDataTestId).locator('input').fill(textToFill);
  // Wait for dropdown options to appear
  const dropdownOptions = page.locator('.MuiAutocomplete-popper li'); // MUI uses this class for dropdown items
  await dropdownOptions.first().waitFor(); // Wait for the first option to become visible
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

test('Check appointment hpi fields are saved after editing', async ({ page }) => {
  await page.goto(`telemed/appointments/${resourceHandler.myAppointment.appointment.id}`);
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter)).toBeVisible(DEFAULT_TIMEOUT);
  const assignButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe);
  // CHECK IF APPOINTMENT IS ASSIGNED ON ME AND ASSIGN IF NOT
  if (await assignButton.isVisible(DEFAULT_TIMEOUT)) {
    await assignButton.click(DEFAULT_TIMEOUT);

    const dialogButtonConfirm = page.getByTestId(dataTestIds.telemedEhrFlow.dialogButtonConfirm);
    await expect(dialogButtonConfirm).toBeVisible(DEFAULT_TIMEOUT);
    await dialogButtonConfirm.click(DEFAULT_TIMEOUT);

    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
    // todo: is it ok to have check like this that rely on status text??
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
  }
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible(DEFAULT_TIMEOUT);
  await expect(
    page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
      .first()
  ).not.toBeVisible(DEFAULT_TIMEOUT);

  const medicalConditionsPattern = 'Z3A';
  const knownAllergiePattern = '10-undecenal';
  const surgicalHistoryPattern = '44950';
  const surgicalNote = 'surgical note';
  const chiefComplaintNotes = 'chief complaint';
  const chiefComplaintRos = 'chief ros';

  await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, medicalConditionsPattern);

  // todo make tests for current medications tab, for this moment it's broken

  await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergiePattern);

  await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, surgicalHistoryPattern);

  await page
    .getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
    .locator('textarea')
    .first()
    .fill(surgicalNote);

  for (const question of ADDITIONAL_QUESTIONS) {
    // HERE WE TAKE ALL QUESTIONS ROWS AND SELECT TRUE LABELED RADIO BUTTON
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
      .locator('input[type="radio"][value="true"]')
      .click(DEFAULT_TIMEOUT);
  }

  await page
    .getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)
    .locator('textarea')
    .first()
    .fill(chiefComplaintNotes);
  await page
    .getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos)
    .locator('textarea')
    .first()
    .fill(chiefComplaintRos);

  // RELOAD PAGE AND CHECK ALL FIELDS ARE SAVED
  await page.reload(DEFAULT_TIMEOUT);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible(DEFAULT_TIMEOUT);
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
    medicalConditionsPattern
  );

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible(DEFAULT_TIMEOUT);
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(medicalConditionsPattern);

  // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible(DEFAULT_TIMEOUT);
  // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toHaveText(surgicalHistoryPattern);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)).toHaveText(surgicalNote);

  for (const question of ADDITIONAL_QUESTIONS) {
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field)).locator('input[value=true]')
    ).toBeChecked();
  }

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)).toHaveText(chiefComplaintNotes);
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos)).toHaveText(chiefComplaintRos);
});

test('Check if connect to patient function is working', async ({ page }) => {
  await page.goto(`telemed/appointments/${resourceHandler.myAppointment.appointment.id}`);
  const assingButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe);
  await expect(assingButton).toBeVisible(DEFAULT_TIMEOUT);
  await assingButton.click(DEFAULT_TIMEOUT);

  const dialogButtonConfirm = page.getByTestId(dataTestIds.telemedEhrFlow.dialogButtonConfirm);
  await expect(dialogButtonConfirm).toBeVisible(DEFAULT_TIMEOUT);
  await dialogButtonConfirm.click(DEFAULT_TIMEOUT);

  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
  await connectButton.click(DEFAULT_TIMEOUT);

  await expect(dialogButtonConfirm).toBeVisible(DEFAULT_TIMEOUT);
  await dialogButtonConfirm.click(DEFAULT_TIMEOUT);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
});
