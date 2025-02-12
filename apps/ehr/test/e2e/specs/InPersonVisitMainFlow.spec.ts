import { test } from '@playwright/test';
import {
  PATIENT_FIRST_NAME,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectVisitsPage } from '../page/VisitsPage';
import { expectInitialScreeningPage } from '../page/InitialScreeningPage';
import { fail } from 'assert';

const NEW_PATIENT_1_LAST_NAME = 'new_1' + PATIENT_LAST_NAME;
const PATIENT_INPUT_BIRTHDAY = '01/01/2024';
const PATIENT_INPUT_GENDER = 'Male';
const REASON_FOR_VISIT = 'Fever';
const VISIT_TYPE_PREBOOK = 'Pre-booked In Person Visit';
const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.initApi();
});

test.afterAll(async () => {
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_1_LAST_NAME);
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/visits/add');
});

test('Open pre-booked tab, click Intake button, Initial screening page is opened with "Intake" status', async ({
  page,
}) => {
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

  await addPatientPage.selectVisitType(VISIT_TYPE_PREBOOK);
  await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();

  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME + ', ' + NEW_PATIENT_1_LAST_NAME);
  await visitsPage.clickIntakeButton(PATIENT_FIRST_NAME + ', ' + NEW_PATIENT_1_LAST_NAME);
  const initialScreeningPage = await expectInitialScreeningPage(
    NEW_PATIENT_1_LAST_NAME + ', ' + PATIENT_FIRST_NAME,
    page
  );

  await initialScreeningPage.checkStatus('intake');
});

test('fail', async ({ page }) => {
  fail('fail');
});
