import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientInformationPage } from '../page/PatientInformationPage';

const HEADER_PATIENT_BIRTHDAY = '01/01/2024 (12 mo)';
const HEADER_PATIENT_GENDER = 'Male';
const HEADER_PATIENT_NAME = 'Test_Doe, Test_John';
const PATIENT_FIRSTNAME = 'Test_John';
const PATIENT_LASTNAME = 'Test_Doe';
const PATIENT_BIRTHDAY = '01/01/2024';
const PATIENT_GENDER = 'male';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/patient/' + resourceHandler.patient.id + '/info');
});

test('Check header info', async ({ page }) => {
  const patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
  const patientHeader = patientInformationPage.getPatientHeader();
  await patientHeader.verifyHeaderPatientID('PID: ' + resourceHandler.patient.id);
  await patientHeader.verifyHeaderPatientName(HEADER_PATIENT_NAME);
  await patientHeader.verifyHeaderPatientBirthSex(HEADER_PATIENT_GENDER);
  await patientHeader.verifyHeaderPatientBirthday(HEADER_PATIENT_BIRTHDAY);
});

test('Check patient info', async ({ page }) => {
  const patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
  await patientInformationPage.verifyPatientLastName(PATIENT_LASTNAME);
  await patientInformationPage.verifyPatientFirstName(PATIENT_FIRSTNAME);
  await patientInformationPage.verifyPatientDateOfBirth(PATIENT_BIRTHDAY);
  await patientInformationPage.verifyPatientBirthSex(PATIENT_GENDER);
});
