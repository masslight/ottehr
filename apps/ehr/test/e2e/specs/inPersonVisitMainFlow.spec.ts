import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { openVisitsPage } from '../page/VisitsPage';
import { expectPatientInfoPage, PatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectAssessmentPage } from '../page/AssessmentPage';

const DIAGNOSIS = 'Situs inversus';
const EM_CODE = '99201 New Patient - E/M Level 1';
const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('Book appointment, start and complete Intake, check statuses', async ({ page }) => {
  const patientInfoPage = await intakeTestAppointment(page);
  await patientInfoPage.cssHeader().verifyStatus('intake');
  await patientInfoPage.sideMenu().clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, go to Hospitalization page and complete Intake, check statuses', async ({ page }) => {
  const patientInfoPage = await intakeTestAppointment(page);
  const hospitalizationPage = await patientInfoPage.sideMenu().clickHospitalization();
  await hospitalizationPage.clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, click Provider on "Patient info", check statuses', async ({ page }) => {
  const patientInfoPage = await intakeTestAppointment(page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  await patientInfoPage.cssHeader().verifyStatus('provider');
});

test('Book appointment,fill required fields for screening, review and sign progress note', async ({ page }) => {
  const patientInfoPage = await intakeTestAppointment(page);
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
  await visitsPage.verifyVisitPresent(resourceHandler.appointment.id!);
});

async function intakeTestAppointment(page: Page): Promise<PatientInfoPage> {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickIntakeButton(resourceHandler.appointment.id!);
  return await expectPatientInfoPage(resourceHandler.appointment.id!, page);
}
