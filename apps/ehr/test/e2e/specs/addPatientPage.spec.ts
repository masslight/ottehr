import { Page, test } from '@playwright/test';
import {
  PATIENT_BIRTH_DATE_LONG,
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  PATIENT_REASON_FOR_VISIT,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { expectVisitsPage } from '../page/VisitsPage';

const PATIENT_PREFILL_NAME = PATIENT_FIRST_NAME + ' ' + PATIENT_LAST_NAME;
const PATIENT_INPUT_BIRTHDAY = PATIENT_BIRTH_DATE_SHORT;
const REASON_FOR_VISIT = PATIENT_REASON_FOR_VISIT;

// todo: remove hardcoded values, use constants from resource-handler
const NEW_PATIENT_1_LAST_NAME = 'new_1' + PATIENT_LAST_NAME;
const NEW_PATIENT_2_LAST_NAME = 'new_2' + PATIENT_LAST_NAME;
const NEW_PATIENT_3_LAST_NAME = 'new_3' + PATIENT_LAST_NAME;
const PATIENT_INPUT_GENDER = 'Male';

const VISIT_TYPES = {
  WALK_IN: 'Walk-in In Person Visit',
  PRE_BOOK: 'Pre-booked In Person Visit',
  POST_TELEMED: 'Post Telemed lab Only',
};

const resourceHandler = new ResourceHandler();

let appointmentIds: string[] = [];

// Ensure cleanup of created appointments after each test
test.afterEach(async () => {
  for (const id of appointmentIds) {
    await resourceHandler.cleanAppointment(id);
  }
  appointmentIds = [];
});

test.beforeEach(async ({ page }) => {
  await page.goto('/visits/add');
});

test('Open "Add patient page", click "Cancel", validation error on "Mobile phone" field shown', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.clickCancelButton();

  await expectVisitsPage(page);
});

test('Open "Add patient page", click "Search patient", validation error on "Mobile phone" field shown', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.verifyMobilePhoneNumberValidationErrorShown();
});

test('Open "Add patient page" then enter invalid phone number, click "Search patient", validation error on "Mobile phone" field shown', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.enterMobilePhone('123');
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.verifyMobilePhoneNumberValidationErrorShown();
});

test('Add button does nothing when any required field is empty', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifySearchForPatientsErrorShown();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterLastName(PATIENT_LAST_NAME);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPES.PRE_BOOK);
  await addPatientPage.clickAddButton();
  await addPatientPage.clickCloseSelectDateWarningDialog();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPES.POST_TELEMED);
  await addPatientPage.clickAddButton();
  await addPatientPage.clickCloseSelectDateWarningDialog();
  await addPatientPage.verifyPageStillOpened();
});

test('Open "Add patient page" then enter invalid date of birth, click "Add", validation error on "Date of Birth" field shown', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterDateOfBirth('3');
  await addPatientPage.verifyDateFormatValidationErrorShown();
});

test.describe('For new patient', () => {
  test('Add walk-in visit for new patient', async ({ page }) => {
    const { appointmentId } = await createAppointment(page, VISIT_TYPES.WALK_IN, false, NEW_PATIENT_1_LAST_NAME);

    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickInOfficeTab();
    await visitsPage.verifyVisitPresent(appointmentId);
  });

  test('Add pre-book visit for new patient', async ({ page }) => {
    const { appointmentId, slotTime } = await createAppointment(
      page,
      VISIT_TYPES.PRE_BOOK,
      false,
      NEW_PATIENT_2_LAST_NAME
    );

    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickPrebookedTab();
    await visitsPage.verifyVisitPresent(appointmentId, slotTime);
  });

  // skipping post-telemed vists tests cause they are unstable for some reason. TODO: investigate
  test.skip('Add post-telemed visit for new patient', async ({ page }) => {
    const { appointmentId, slotTime } = await createAppointment(
      page,
      VISIT_TYPES.POST_TELEMED,
      false,
      NEW_PATIENT_3_LAST_NAME
    );

    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickPrebookedTab();
    await visitsPage.verifyVisitPresent(appointmentId, slotTime);
  });
});

test.describe('For existing patient', () => {
  test.beforeAll(async () => {
    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Add walk-in visit for existing patient', async ({ page }) => {
    const { appointmentId } = await createAppointment(page, VISIT_TYPES.WALK_IN, true);
    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickInOfficeTab();
    await visitsPage.verifyVisitPresent(appointmentId);
  });

  test('Add pre-book visit for existing patient', async ({ page }) => {
    const { appointmentId, slotTime } = await createAppointment(page, VISIT_TYPES.PRE_BOOK, true);

    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickPrebookedTab();
    await visitsPage.verifyVisitPresent(appointmentId, slotTime);
  });

  // skipping post-telemed vists tests cause they are unstable for some reason. TODO: investigate
  test('Add post-telemed visit for existing patient', async ({ page }) => {
    const { appointmentId, slotTime } = await createAppointment(page, VISIT_TYPES.POST_TELEMED, true);

    const visitsPage = await expectVisitsPage(page);
    await visitsPage.selectLocation(ENV_LOCATION_NAME!);
    await visitsPage.clickPrebookedTab();
    await visitsPage.verifyVisitPresent(appointmentId, slotTime);
  });
});

async function createAppointment(
  page: Page,
  visitType: (typeof VISIT_TYPES)[keyof typeof VISIT_TYPES],
  existingPatient: boolean = false,
  lastName?: string
): Promise<{ appointmentId: string; slotTime: string | undefined }> {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();

  if (existingPatient) {
    await addPatientPage.selectExistingPatient(PATIENT_PREFILL_NAME);
    await addPatientPage.clickPrefillForButton();

    await addPatientPage.verifyPrefilledPatientName(PATIENT_PREFILL_NAME);
    await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_BIRTH_DATE_LONG);
    await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_INPUT_GENDER);
    await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);
    await addPatientPage.selectReasonForVisit(PATIENT_REASON_FOR_VISIT);
  } else {
    await addPatientPage.clickPatientNotFoundButton();
    await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
    await addPatientPage.enterLastName(lastName || '');
    await addPatientPage.enterDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
    await addPatientPage.selectReasonForVisit(PATIENT_REASON_FOR_VISIT);
  }

  let slotTime: string | undefined;
  await addPatientPage.selectVisitType(visitType);
  if (visitType !== VISIT_TYPES.WALK_IN) {
    slotTime = await addPatientPage.selectFirstAvailableSlot();
  }

  const appointmentCreationResponse = page.waitForResponse(/\/create-appointment\//);
  await addPatientPage.clickAddButton();
  const response = await appointmentCreationResponse;
  const { appointment } = await response.json();
  appointmentIds.push(appointment);
  return { appointmentId: appointment, slotTime };
}
