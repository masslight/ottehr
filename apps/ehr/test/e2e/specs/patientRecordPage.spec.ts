import { test } from '@playwright/test';
import {
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_BIRTHDAY,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';

import { expectPatientRecordPage } from '../page/PatientRecordPage';
import { expectPatientInformationPage } from '../page/PatientInformationPage';
import { getMaxListeners } from 'events';



const resourceHandler = new ResourceHandler();

test.beforeEach(async ({page}) => {
  await resourceHandler.setResources();
  await page.waitForTimeout(2000);
  await page.goto('/patient/' + resourceHandler.patient.id);
});

test.afterEach(async () => {
  await resourceHandler.cleanupResources();
});

test('Click on "See all patient info button", Patient Info Page is opened', async ({ page }) => {
  const patientRecordPage = await expectPatientRecordPage(resourceHandler.patient.id!, page);
  await patientRecordPage.clickSeeAllPatientInfoButton();
  await expectPatientInformationPage(page, resourceHandler.patient.id!);
});


test('Fill and save required valus on Patient Info Pgae, values are saved and updated successfully', async ({ page }) => {
  const patientRecordPage = await expectPatientRecordPage(resourceHandler.patient.id!, page);
  await patientRecordPage.clickSeeAllPatientInfoButton();
  const patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
  await patientInformationPage.enterPatientLastName('Test_lastname');
  await patientInformationPage.enterPatientFirstName('Test_firstname');
  await patientInformationPage.enterPatientDateOfBirth('01/01/2024');
  await patientInformationPage.selectPatientBirthSex('Female');
  await patientInformationPage.enterStreetaddress('Test address, 1');
  await patientInformationPage.enterCity('New York');
  await patientInformationPage.selectState('CA');
  await patientInformationPage.enterPatientEmail('testemail@getMaxListeners.com');
  await patientInformationPage.enterPatientMobile('2027139680');
  await patientInformationPage.selectPatientEthnicity('Hispanic or Latino');
  await patientInformationPage.selectPatientRace('Asian');
  await patientInformationPage.selectRelationship('Self');
  await patientInformationPage.enterFullName('Last name, First name');
  
});