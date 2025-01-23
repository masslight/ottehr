import { test } from '@playwright/test';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const PHONE_NUMBER = '2144985555';
const PATIENT_NAME = 'Test_John Test_Doe';
const PATIENT_BIRTHDAY = 'January 01, 2024';
const PATIENT_GENDER = 'male';
const PATIENT_EMAIL = 'john.doe@example.com';
const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/visits/add');
});

test('Open "Add patient page", click "Cancel", validation error on "Mobile phone" field shown', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.clickCancelButton();
  // TODO: Uncomment line below when adding patient will be fixed
  // await expectVisitsPage(page);
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

  await addPatientPage.enterMobilePhone(PHONE_NUMBER);
  await addPatientPage.clickAddButton();
  await addPatientPage.verifySearchForPatientsErrorShown();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterFirstName('Alisia');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterLastName('Broocks');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.enterDateOfBirth('12/12/2000');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectSexAtBirth('Male');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit('Fever');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType('Walk-in In Person Visit');
  await addPatientPage.clickAddButton();

  // TODO: Uncomment line below when adding patient will be fixed
  // await expectVisitsPage(page);
});

test('Open "Add patient page" then enter invalid date of birth, click "Add", validation error on "Date of Birth" field shown', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterDateOfBirth('3');
  await addPatientPage.verifyDateFormatValidationErrorShown();
});

test('Open "Add patient page" then enter office and phone number, click "Search for patients", "select an existing qrs patient" window is opened', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_NAME);
  await addPatientPage.clickPrefillForButton();

  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectReasonForVisit('Fever');
  await addPatientPage.clickAddButton();
  await addPatientPage.verifyPageStillOpened();

  await addPatientPage.selectVisitType('Walk-in In Person Visit');
  await addPatientPage.clickAddButton();
  // TODO: Uncomment line below when adding patient will be fixed
  // await expectVisitsPage(page);
});

test('Open "Select an existing qrs patient window" and select any user, click "Prefill for button", users data is prefilled', async ({
  page,
}) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_NAME);
  await addPatientPage.clickPrefillForButton();
  await addPatientPage.verifyPrefilledPatientName(PATIENT_NAME);
  await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_BIRTHDAY);
  await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_GENDER);
  await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);
});

test('Add walk-in visit for existing patient', async ({ page }) => {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.selectExistingPatient(PATIENT_NAME);
  await addPatientPage.clickPrefillForButton();
  await addPatientPage.verifyPrefilledPatientName(PATIENT_NAME);
  await addPatientPage.verifyPrefilledPatientBirthday(PATIENT_BIRTHDAY);
  await addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_GENDER);
  await addPatientPage.verifyPrefilledPatientEmail(PATIENT_EMAIL);
  await addPatientPage.selectReasonForVisit('Fever');
  await addPatientPage.selectVisitType('Walk-in In Person Visit');
  await addPatientPage.clickAddButton();
  // TODO: Uncomment line below when adding patient will be fixed
  // await expectVisitsPage(page);
});
