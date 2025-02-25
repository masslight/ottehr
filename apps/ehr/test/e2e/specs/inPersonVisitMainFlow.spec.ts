import { Page, test } from '@playwright/test';
import {
  PATIENT_FIRST_NAME,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectAddPatientPage } from '../page/AddPatientPage';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { expectVisitsPage, openVisitsPage } from '../page/VisitsPage';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectAssessmentPage } from '../page/AssessmentPage';

const NEW_PATIENT_1_LAST_NAME = 'new_1' + PATIENT_LAST_NAME;
const NEW_PATIENT_2_LAST_NAME = 'new_2' + PATIENT_LAST_NAME;
const NEW_PATIENT_3_LAST_NAME = 'new_3' + PATIENT_LAST_NAME;
const NEW_PATIENT_4_LAST_NAME = 'new_4' + PATIENT_LAST_NAME;
const PATIENT_INPUT_BIRTHDAY = '01/01/2024';
const PATIENT_INPUT_GENDER = 'Male';
const REASON_FOR_VISIT = 'Fever';
const VISIT_TYPE_PREBOOK = 'Pre-booked In Person Visit';
const DIAGNOSIS = 'Situs inversus';
const EM_CODE = '99201 New Patient - E/M Level 1';
const resourceHandler = new ResourceHandler();

test.afterAll(async () => {
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_1_LAST_NAME);
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_2_LAST_NAME);
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_3_LAST_NAME);
  await resourceHandler.cleanupNewPatientData(NEW_PATIENT_4_LAST_NAME);
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/visits/add');
});

test('Book appointment, start and complete Intake, check statuses', async ({ page }) => {
  await addAppointment(NEW_PATIENT_1_LAST_NAME, page);

  const patientInfoPage = await expectPatientInfoPage(NEW_PATIENT_1_LAST_NAME + ', ' + PATIENT_FIRST_NAME, page);
  await patientInfoPage.cssHeader().verifyStatus('intake');
  await patientInfoPage.sideMenu().clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, go to Hospitalization page and complete Intake, check statuses', async ({ page }) => {
  await addAppointment(NEW_PATIENT_2_LAST_NAME, page);

  const patientInfoPage = await expectPatientInfoPage(NEW_PATIENT_2_LAST_NAME + ', ' + PATIENT_FIRST_NAME, page);
  const hospitalizationPage = await patientInfoPage.sideMenu().clickHospitalization();
  await hospitalizationPage.clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, click Provider on "Patient info", check statuses', async ({ page }) => {
  await addAppointment(NEW_PATIENT_3_LAST_NAME, page);

  const patientInfoPage = await expectPatientInfoPage(NEW_PATIENT_3_LAST_NAME + ', ' + PATIENT_FIRST_NAME, page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  await patientInfoPage.cssHeader().verifyStatus('provider');
});

test('Book appointment,fill required fields for screening, review and sign progress note', async ({ page }) => {
  await addAppointment(NEW_PATIENT_4_LAST_NAME, page);
  const patientInfoPage = await expectPatientInfoPage(NEW_PATIENT_4_LAST_NAME + ', ' + PATIENT_FIRST_NAME, page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectProgressNotePage(page);
  await progressNotePage.verifyReviewAndSignButtonDisabled();
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis(DIAGNOSIS);
  await assessmentPage.selectEMCode(EM_CODE);
  await patientInfoPage.sideMenu().clickProgressNote();
  await progressNotePage.clickReviewAndSignButton();
  await progressNotePage.clickSignButton();
  await patientInfoPage.cssHeader().verifyStatus('completed');

  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickDischargedTab();
  await visitsPage.verifyVisitPresent(PATIENT_FIRST_NAME, NEW_PATIENT_4_LAST_NAME);
});

async function addAppointment(patientLastName: string, page: Page): Promise<void> {
  const addPatientPage = await expectAddPatientPage(page);
  await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
  await addPatientPage.enterMobilePhone(PATIENT_PHONE_NUMBER);
  await addPatientPage.clickSearchForPatientsButton();
  await addPatientPage.clickPatientNotFoundButton();
  await addPatientPage.enterFirstName(PATIENT_FIRST_NAME);
  await addPatientPage.enterLastName(patientLastName);
  await addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY);
  await addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER);
  await addPatientPage.selectReasonForVisit(REASON_FOR_VISIT);
  await addPatientPage.selectVisitType(VISIT_TYPE_PREBOOK);
  await addPatientPage.selectFirstAvailableSlot();
  await addPatientPage.clickAddButton();
  const visitsPage = await expectVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickIntakeButton(patientLastName + ', ' + PATIENT_FIRST_NAME);
}
