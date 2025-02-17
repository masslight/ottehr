import { test } from '@playwright/test';
import {
  PATIENT_BIRTHDAY,
  PATIENT_BIRTHDAY_FORMATTED,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { expectPatientInformationPage } from '../page/PatientInformationPage';
import { formatDOB } from 'utils';

const HEADER_PATIENT_BIRTHDAY = formatDOB(PATIENT_BIRTHDAY)!;
const HEADER_PATIENT_GENDER = 'Male';
const HEADER_PATIENT_NAME = PATIENT_LAST_NAME + ', ' + PATIENT_FIRST_NAME;
const PATIENT_DATE_OF_BIRTH = PATIENT_BIRTHDAY_FORMATTED;

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
  await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
  await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
  await patientInformationPage.verifyPatientDateOfBirth(PATIENT_DATE_OF_BIRTH);
  await patientInformationPage.verifyPatientBirthSex(PATIENT_GENDER);
});
