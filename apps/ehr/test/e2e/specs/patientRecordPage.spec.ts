import { test } from '@playwright/test';
import {
 
  ResourceHandler,
} from '../../e2e-utils/resource-handler';

import { expectPatientRecordPage } from '../page/PatientRecordPage';
import { expectPatientInformationPage, openPatientInformationPage, PatientInformationPage } from '../page/PatientInformationPage';




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


test('Fill and save required values on Patient Info Page, values are saved and updated successfully', async ({ page }) => {
  const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!,);
  await patientInformationPage.enterPatientLastName('Test_lastname');
  await patientInformationPage.enterPatientFirstName('Test_firstname');
  await patientInformationPage.enterPatientDateOfBirth('01/01/2024');
  await patientInformationPage.selectPatientBirthSex('Female');
  await patientInformationPage.enterStreetAddress('Test address, 1');
  await patientInformationPage.enterCity('New York');
  await patientInformationPage.selectState('CA');
  await patientInformationPage.enterPatientEmail('testemail@getMaxListeners.com');
  await patientInformationPage.enterPatientMobile('2027139680');
  await patientInformationPage.selectPatientEthnicity('Hispanic or Latino');
  await patientInformationPage.selectPatientRace('Asian');
  await patientInformationPage.selectRelationship('Self');
  await patientInformationPage.enterFullName('Last name, First name');
  await patientInformationPage.enterDateOfBirthFromResponsibleContainer('10/10/2000');
  await patientInformationPage.selectBirthSexFromResponsibleContainer('Male');
  await patientInformationPage.enterPhoneFromResponsibleContainer('1111111111');
  await patientInformationPage.selectReleaseOfInfo('Yes, Release Allowed'); 
  await patientInformationPage.selectRxHistoryConsent('Rx history consent signed by the patient'); 
  await patientInformationPage.clickSaveChangesButton();
  await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
  await patientInformationPage.reloadPatientInformationPage();

  await patientInformationPage.verifyPatientLastName('Test_lastname');
  await patientInformationPage.verifyPatientFirstName('Test_firstname');
  await patientInformationPage.verifyPatientDateOfBirth('01/01/2024');
  await patientInformationPage.verifyPatientBirthSex('female');
  await patientInformationPage.verifyStreetAddress('Test address, 1');
  await patientInformationPage.verifyCity('New York');
  await patientInformationPage.verifyState('CA');
  await patientInformationPage.verifyPatientEmail('testemail@getMaxListeners.com');
  await patientInformationPage.verifyPatientMobile('+12027139680');
  await patientInformationPage.verifyPatientEthnicity('Hispanic or Latino');
  await patientInformationPage.verifyPatientRace('Asian');
  await patientInformationPage.verifyRelationship('Self');
  await patientInformationPage.verifyFullName('Last name, First name');
  await patientInformationPage.verifyDateOfBirthFromResponsibleContainer('10/10/2000');
  await patientInformationPage.verifyBirthSexFromResponsibleContainer('male');
  await patientInformationPage.verifyPhoneFromResponsibleContainer('+11111111111');
  await patientInformationPage.verifyReleaseOfInfo('Yes, Release Allowed'); 
  await patientInformationPage.verifyRxHistoryConsent('Rx history consent signed by the patient'); 
});