import { test } from '@playwright/test';
import {
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectVisitsPage } from '../page/VisitsPage';

const NEW_PATIENT_1_LAST_NAME = 'new_1' + PATIENT_LAST_NAME;
const NEW_PATIENT_2_LAST_NAME = 'new_2' + PATIENT_LAST_NAME;
const NEW_PATIENT_3_LAST_NAME = 'new_3' + PATIENT_LAST_NAME;
const PATIENT_PREFILL_NAME = PATIENT_FIRST_NAME + ' ' + PATIENT_LAST_NAME;
const PATIENT_PREFILL_BIRTHDAY = 'January 01, 2024';
const PATIENT_INPUT_BIRTHDAY = '01/01/2024';
const PATIENT_INPUT_GENDER = 'Male';
const REASON_FOR_VISIT = 'Fever';
const VISIT_TYPE_WALK = 'Walk-in In Person Visit';
const VISIT_TYPE_PREBOOK = 'Pre-booked In Person Visit';
const VISIT_TYPE_POST_TELEMED = 'Post Telemed lab Only';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_1_LAST_NAME);
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_2_LAST_NAME);
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_3_LAST_NAME);
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
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

  await addPatientPage.selectVisitType(VISIT_TYPE_PREBOOK);
  await addPatientPage.clickAddButton();
  await addPatientPage.clickCloseSelectDateWarningDialog();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPE_POST_TELEMED);
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

test('Add walk-in visit for existing patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_PREFILL_NAME);
  await addPatientPage.clickPrefillForButton();

  await addPatientPage.verifyPrefilledPatientName(PATIENT_PREFILL_NAME);
  await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_PREFILL_BIRTHDAY);
  await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_GENDER);
  await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);

  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPE_WALK);
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickInOfficeTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, PATIENT_LAST_NAME);
});

test('Add walk-in visit for new patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
  await addPatientPage.enterLastName(NEW_PATIENT_1_LAST_NAME);
  await addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY);
  await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);

  await addPatientPage.selectVisitType(VISIT_TYPE_WALK);
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickInOfficeTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, NEW_PATIENT_1_LAST_NAME);
});

test('Add pre-book visit for existing patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_PREFILL_NAME);
  await addPatientPage.clickPrefillForButton();

  await addPatientPage.verifyPrefilledPatientName(PATIENT_PREFILL_NAME);
  await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_PREFILL_BIRTHDAY);
  await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_GENDER);
  await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);

  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPE_PREBOOK);
  const slotTime = await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, PATIENT_LAST_NAME, slotTime);
});

test('Add pre-book visit for new patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
  await addPatientPage.enterLastName(NEW_PATIENT_2_LAST_NAME);
  await addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY);
  await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);

  await addPatientPage.selectVisitType(VISIT_TYPE_PREBOOK);
  const slotTime = await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, NEW_PATIENT_2_LAST_NAME, slotTime);
});

test('Add post-telemed visit for existing patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_PREFILL_NAME);
  await addPatientPage.clickPrefillForButton();

  await addPatientPage.verifyPrefilledPatientName(PATIENT_PREFILL_NAME);
  await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_PREFILL_BIRTHDAY);
  await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_GENDER);
  await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);

  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType(VISIT_TYPE_POST_TELEMED);
  const slotTime = await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, PATIENT_LAST_NAME, slotTime);
});

test('Add post-telemed visit for new patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
  await addPatientPage.enterLastName(NEW_PATIENT_3_LAST_NAME);
  await addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY);
  await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);

  await addPatientPage.selectVisitType(VISIT_TYPE_POST_TELEMED);
  const slotTime = await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, NEW_PATIENT_3_LAST_NAME, slotTime);
});
