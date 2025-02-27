import { Page, test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import { openVisitsPage } from '../page/VisitsPage';
import { expectPatientInfoPage } from '../page/PatientInfo';
import { expectProgressNotePage } from '../page/ProgressNotePage';
import { expectAssessmentPage } from '../page/AssessmentPage';

const DIAGNOSIS = 'Situs inversus';
const EM_CODE = '99201 New Patient - E/M Level 1';
const resourceHandler = new ResourceHandler('in-person');

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.beforeEach(async ({ page }) => {
  const appointmentId = resourceHandler.appointment.id ?? '';
  await resourceHandler.waitTillAppointmentPreprocessed(appointmentId);
  await intakeAppointment(appointmentId, page);
});

test('Book appointment, start and complete Intake, check statuses', async ({ page }) => {
  const patientInfoPage = await expectPatientInfoPage(getPatientFirstName(), getPatientLastName(), page);
  await patientInfoPage.cssHeader().verifyStatus('intake');
  await patientInfoPage.sideMenu().clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, go to Hospitalization page and complete Intake, check statuses', async ({ page }) => {
  const patientInfoPage = await expectPatientInfoPage(getPatientFirstName(), getPatientLastName(), page);
  const hospitalizationPage = await patientInfoPage.sideMenu().clickHospitalization();
  await hospitalizationPage.clickCompleteIntakeButton();
  await patientInfoPage.cssHeader().verifyStatus('ready for provider');
});

test('Book appointment, click Provider on "Patient info", check statuses', async ({ page }) => {
  const patientInfoPage = await expectPatientInfoPage(getPatientFirstName(), getPatientLastName(), page);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  await patientInfoPage.cssHeader().verifyStatus('provider');
});

test('Book appointment,fill required fields for screening, review and sign progress note', async ({ page }) => {
  const patientInfoPage = await expectPatientInfoPage(getPatientFirstName(), getPatientLastName(), page);
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
  await visitsPage.verifyVisitPresent(getPatientFirstName(), getPatientLastName());
});

function getPatientFirstName(): string {
  return resourceHandler.patient.name?.[0]?.given?.[0] ?? '';
}

function getPatientLastName(): string {
  return resourceHandler.patient.name?.[0]?.family ?? '';
}

async function intakeAppointment(appointmentId: string, page: Page): Promise<void> {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickIntakeButton(appointmentId);
}
