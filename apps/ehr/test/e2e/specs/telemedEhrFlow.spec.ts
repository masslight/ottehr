import { expect, Locator, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import {
  ADDITIONAL_QUESTIONS,
  stateCodeToFullName,
  TelemedAppointmentStatusEnum,
} from '../../e2e-utils/temp-imports-from-utils';
import { PATIENT_STATE, ResourceHandler } from '../../e2e-utils/resource-handler';
import { TelemedFlowResourceHandler } from '../../e2e-utils/resource-handlers/telemed-flow-rh';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new ResourceHandler('telemed');
const resourceHandler2 = new TelemedFlowResourceHandler();

const DEFAULT_TIMEOUT = { timeout: 15000 };

test.beforeAll(async () => {
  await resourceHandler.setResources();
  await resourceHandler2.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await resourceHandler2.cleanupResources();
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

async function fillWaitAndSelectDropdown(page: Page, dropdownDataTestId: string, textToFill: string): Promise<void> {
  // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).click(DEFAULT_TIMEOUT);
  await page.getByTestId(dropdownDataTestId).locator('input').fill(textToFill);
  // Wait for dropdown options to appear
  const dropdownOptions = page.locator('.MuiAutocomplete-popper li'); // MUI uses this class for dropdown items
  await dropdownOptions.first().waitFor(); // Wait for the first option to become visible
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

async function dialogConfirm(page: Page): Promise<void> {
  const dialogButtonConfirm = page.getByTestId(dataTestIds.telemedEhrFlow.dialogButtonConfirm);
  await expect(dialogButtonConfirm).toBeVisible(DEFAULT_TIMEOUT);
  await dialogButtonConfirm.click(DEFAULT_TIMEOUT);
}

async function checkAppointmentAssigned(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter)).toBeVisible(DEFAULT_TIMEOUT);
  const assignButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe);
  // CHECK IF APPOINTMENT IS ASSIGNED ON ME AND ASSIGN IF NOT
  if (await assignButton.isVisible(DEFAULT_TIMEOUT)) {
    await assignButton.click(DEFAULT_TIMEOUT);

    await dialogConfirm(page);

    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
    // todo: is it ok to have check like this that rely on status text??
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
  }
}

test.describe('Appointment appearing correctly', async () => {
  test("in 'my patients' tab", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointments(page);

    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    ).toBeVisible(DEFAULT_TIMEOUT);

    // const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
    // let foundMyAppointment = false;
    // await iterateThroughTable(table, async (row) => {
    //   const rowText = await row.innerText(DEFAULT_TIMEOUT);
    //   if (rowText?.includes(resourceHandler.appointment.id!)) {
    //     foundMyAppointment = true;
    //   }
    // });
    // expect(foundMyAppointment).toBe(true);
  });

  test("other appointment in 'all patients' tab.", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointments(page);

    await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
    await awaitAppointments(page);

    let foundOtherAppointment = false;
    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
    await iterateThroughTable(table, async (row) => {
      const rowText = await row.innerText(DEFAULT_TIMEOUT);
      if (rowText?.includes(resourceHandler.appointment.id!)) {
        foundOtherAppointment = true;
      }
    });
    expect(foundOtherAppointment).toBe(true);
  });
});

test('Appointment has location label and is in a relevant location group', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
  let foundLocationGroup = false;
  let foundAppointment = false;

  const state = PATIENT_STATE;
  const fullStateName = stateCodeToFullName[state];

  await iterateThroughTable(table, async (row) => {
    if (foundAppointment) return;
    const rowText = await row.innerText(DEFAULT_TIMEOUT);

    if (foundLocationGroup && !rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready)) {
      foundLocationGroup = false;
    }

    if (rowText.includes(fullStateName)) {
      foundLocationGroup = true;
    }

    if (foundLocationGroup && rowText.includes(resourceHandler.appointment?.id ?? '') && rowText.includes(state)) {
      foundAppointment = true;
    }
  });

  expect(foundAppointment && foundLocationGroup).toBe(true);
});

test('All appointments in my-patients section has appropriate assign buttons', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText(DEFAULT_TIMEOUT);
    if (rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready)) {
      await expect(row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton)).toBeVisible(DEFAULT_TIMEOUT);
    }
  });
});

test('Appointment in all-patients section are readonly', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  await test.step('go to all patients and find appointment', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
    await awaitAppointments(page);

    const otherAppointmentViewButton = page.getByTestId(
      dataTestIds.telemedEhrFlow.trackingBoardViewButton(resourceHandler2.otherAppointment.appointment.id!)
    );

    expect(otherAppointmentViewButton).toBeDefined();
    await otherAppointmentViewButton?.click(DEFAULT_TIMEOUT);
  });

  await test.step('check that after clicking there are readonly view', async () => {
    const footer = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter);
    await expect(footer).toBeVisible(DEFAULT_TIMEOUT);
    await expect(footer.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe)).not.toBeVisible();
  });
});

test('Assigned appointment has connect-to-patient button', async ({ page }) => {
  await page.goto(`telemed/appointments`);
  await awaitAppointments(page);

  await test.step('Find and assign my appointment', async () => {
    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
    let myAppointmentAssignButton: Locator | undefined;
    await iterateThroughTable(table, async (row) => {
      const rowText = await row.innerText(DEFAULT_TIMEOUT);
      if (rowText?.includes(resourceHandler.appointment.id!)) {
        myAppointmentAssignButton = row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton);
      }
    });
    expect(myAppointmentAssignButton).toBeDefined();
    await myAppointmentAssignButton?.click(DEFAULT_TIMEOUT);
  });

  await dialogConfirm(page);

  await test.step('Appointment has connect-to-patient button', async () => {
    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
    // todo: is it ok to have check like this that rely on status text??
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(
      DEFAULT_TIMEOUT
    );
  });
});

test('Appointment hpi fields', async ({ page }) => {
  const medicalConditionsPattern = 'Z3A';
  const knownAllergiePattern = '10-undecenal';
  const surgicalHistoryPattern = '44950';
  const surgicalNote = 'surgical note';
  const chiefComplaintNotes = 'chief complaint';
  const chiefComplaintRos = 'chief ros';

  await test.step("go to appointment page and make sure it's in pre-video", async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await checkAppointmentAssigned(page);
  });

  await test.step('await until hpi fields are ready', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible(DEFAULT_TIMEOUT);
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
        .first()
    ).not.toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('filling up all editable fields', async () => {
    await fillWaitAndSelectDropdown(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      medicalConditionsPattern
    );

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

    await page.waitForTimeout(10000); // ensure resources are saved
  });

  await test.step('reload and wait until data is loaded', async () => {
    await page.reload(DEFAULT_TIMEOUT);
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
        .first()
    ).not.toBeVisible(DEFAULT_TIMEOUT);
  });

  await test.step('check medical conditions list', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
      RegExp(medicalConditionsPattern)
    );
  });

  await test.step('check known allergies list', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible(DEFAULT_TIMEOUT);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
      RegExp(knownAllergiePattern)
    );
  });

  await test.step('check surgical history list and note', async () => {
    // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible(DEFAULT_TIMEOUT);
    // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toHaveText(surgicalHistoryPattern);

    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()
    ).toHaveText(surgicalNote);
  });

  await test.step('check additional questions', async () => {
    for (const question of ADDITIONAL_QUESTIONS) {
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field)).locator('input[value=true]')
      ).toBeChecked();
    }
  });

  await test.step('chief complaint notes and ros', async () => {
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).locator('textarea').first()
    ).toHaveText(chiefComplaintNotes);
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first()
    ).toHaveText(chiefComplaintRos);
  });
});

test('Connect to patient function', async ({ page }) => {
  await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
  await checkAppointmentAssigned(page);

  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
  await connectButton.click(DEFAULT_TIMEOUT);

  await dialogConfirm(page);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
});
