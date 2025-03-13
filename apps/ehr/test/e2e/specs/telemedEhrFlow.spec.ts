import { BrowserContext, expect, Locator, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { TelemedFlowResourceHandler } from '../../e2e-utils/resource-handlers/telemed-flow-rh';
import { awaitAppointmentsTableToBeVisible, telemedDialogConfirm } from '../../e2e-utils/helpers/tests-utils';
import { allLicensesForPractitioner, AllStates, stateCodeToFullName, TelemedAppointmentStatusEnum } from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../src/constants';

const myResources = new ResourceHandler('telemed');
const otherResources = new ResourceHandler('telemed');
const telemedRH = new TelemedFlowResourceHandler();
let myState: string;
let otherState: string;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();

  const myPractitioner = await telemedRH.getMyUserAndPractitioner();
  const myPractitionerLicenses: string[] = [];
  allLicensesForPractitioner(myPractitioner.practitioner).forEach((license) => {
    if (license.active && license.state) myPractitionerLicenses.push(license.state);
  });
  myState = myPractitionerLicenses[0];
  otherState = AllStates.find((state) => !myPractitionerLicenses.includes(state.value)).value;
  if (!myState || !otherState)
    throw new Error('My practitioner has no active qualification states, or has all states in qualification');
  console.log(`My state ${myState}, other state: ${otherState}`);

  await myResources.setResources({ state: myState });
  await otherResources.setResources({ state: otherState });
});

test.afterAll(async () => {
  await myResources.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

async function iterateThroughTable(tableLocator: Locator, callback: (row: Locator) => Promise<void>): Promise<void> {
  const rows = tableLocator.locator('tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    await callback(rows.nth(i));
  }
}

async function fillWaitAndSelectDropdown(page: Page, dropdownDataTestId: string, textToFill: string): Promise<void> {
  // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).click();
  await page.getByTestId(dropdownDataTestId).locator('input').fill(textToFill);
  // Wait for dropdown options to appear
  const dropdownOptions = page.locator('.MuiAutocomplete-popper li'); // MUI uses this class for dropdown items
  await dropdownOptions.first().waitFor(); // Wait for the first option to become visible
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

async function checkAppointmentAssigned(page: Page): Promise<void> {
  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter)).toBeVisible();
  const assignButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe);
  // CHECK IF APPOINTMENT IS ASSIGNED ON ME AND ASSIGN IF NOT
  if (await assignButton.isVisible()) {
    await assignButton.click();

    await telemedDialogConfirm(page);

    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible();
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
  }
}

test("Appointment should appear correctly in 'my patients' tab", async () => {
  await page.goto(`telemed/appointments`);
  await awaitAppointmentsTableToBeVisible(page);

  await expect(
    page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(myResources.appointment.id!))
  ).toBeVisible();
});

test("Appointment should appear correctly in 'all patients' tab.", async () => {
  await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click();
  await awaitAppointmentsTableToBeVisible(page);

  await expect(
    page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(otherResources.appointment.id!))
  ).toBeVisible();
});

test('Appointment has location label and is in a relevant location group', async () => {
  await page.goto(`telemed/appointments`);
  await awaitAppointmentsTableToBeVisible(page);

  const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
  let foundLocationGroup = false;
  let foundAppointment = false;

  const fullStateName = stateCodeToFullName[myState];

  await iterateThroughTable(table, async (row) => {
    if (foundAppointment) return;
    const rowText = await row.innerText();

    if (foundLocationGroup && !rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready)) {
      foundLocationGroup = false;
    }

    if (rowText.includes(fullStateName)) {
      foundLocationGroup = true;
    }

    if (foundLocationGroup && rowText.includes(myResources.appointment?.id ?? '') && rowText.includes(myState)) {
      foundAppointment = true;
    }
  });

  expect(foundAppointment && foundLocationGroup).toBe(true);
});

test('All appointments in my-patients section has appropriate assign buttons', async () => {
  const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
  await iterateThroughTable(table, async (row) => {
    const rowText = await row.innerText();
    if (rowText.toLowerCase().includes(TelemedAppointmentStatusEnum.ready)) {
      await expect(row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton)).toBeVisible();
    }
  });
});

test('Appointment in all-patients section should be readonly', async () => {
  await test.step('go to all patients and find appointment', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click();
    await awaitAppointmentsTableToBeVisible(page);

    const otherAppointmentViewButton = page.getByTestId(
      dataTestIds.telemedEhrFlow.trackingBoardViewButton(otherResources.appointment.id!)
    );

    expect(otherAppointmentViewButton).toBeDefined();
    await otherAppointmentViewButton?.click();
  });

  await test.step('check that after clicking there are readonly view', async () => {
    const footer = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter);
    await expect(footer).toBeVisible();
    await expect(footer.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe)).not.toBeVisible();
  });
});

test('Assigned appointment has connect-to-patient button', async () => {
  await page.goto(`telemed/appointments`);
  await awaitAppointmentsTableToBeVisible(page);

  await test.step('Find and assign my appointment', async () => {
    const myAppointmentAssignButton = page
      .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(myResources.appointment.id!))
      .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton);

    expect(myAppointmentAssignButton).toBeDefined();
    await myAppointmentAssignButton?.click();
  });

  await telemedDialogConfirm(page);

  await test.step('Appointment has connect-to-patient button', async () => {
    const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
    await expect(statusChip).toBeVisible();
    await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible();
  });
});

test('Appointment hpi fields', async () => {
  const medicalConditionsPattern = 'Z3A';
  const knownAllergiePattern = '10-undecenal';
  const surgicalHistoryPattern = '44950';
  const surgicalNote = 'surgical note';
  const chiefComplaintNotes = 'chief complaint';
  const chiefComplaintRos = 'chief ros';

  await test.step("go to appointment page and make sure it's in pre-video", async () => {
    await page.goto(`telemed/appointments/${myResources.appointment.id}`);
    await checkAppointmentAssigned(page);
  });

  await test.step('await until hpi fields are ready', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible();
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
        .first()
    ).not.toBeVisible();
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
        .click();
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
    await page.reload();
    await page.goto(`telemed/appointments/${myResources.appointment.id}`);
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
        .first()
    ).not.toBeVisible();
  });

  await test.step('check medical conditions list', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
      RegExp(medicalConditionsPattern)
    );
  });

  await test.step('check known allergies list', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
      RegExp(knownAllergiePattern)
    );
  });

  await test.step('check surgical history list and note', async () => {
    // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible();
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

test('Connect to patient function', async () => {
  await page.goto(`telemed/appointments/${myResources.appointment.id}`);
  await checkAppointmentAssigned(page);

  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible();
  await connectButton.click();

  await telemedDialogConfirm(page);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible();
});
