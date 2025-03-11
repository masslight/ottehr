import { test } from '@playwright/test';
import {
 
  ResourceHandler,
} from '../../e2e-utils/resource-handler';

import { expectPatientRecordPage } from '../page/PatientRecordPage';
import { expectPatientInformationPage, openPatientInformationPage, PatientInformationPage } from '../page/PatientInformationPage';

const resourceHandler = new ResourceHandler();
const PATIENT_LAST_NAME = 'Test_lastname'; 
const PATIENT_FIRST_NAME = 'Test_firstname';
const PATIENT_DATE_OF_BIRTH = '01/01/2024';
const PATIENT_BIRTH_SEX = 'Female';
const STREET_ADDRESS = 'Test address, 1';
const CITY = 'New York';
const STATE = 'CA';
const PATIENT_EMAIL = 'testemail@getMaxListeners.com';
const PATIENT_MOBILE = '2027139680';
const PATIENT_ETHNICITY = 'Hispanic or Latino';
const PATIENT_RACE = 'Asian';
const RELATIONSHIP = 'Self';
const FULL_NAME = 'Last name, First name';
const BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
const BIRTSEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const PHONE_FROM_RESPONSIBLE_CONTAINER = '1111111111';
const RELEASE_OF_INFO = 'Yes, Release Allowed';
const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';


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
  await patientInformationPage.enterPatientLastName(PATIENT_LAST_NAME);
  await patientInformationPage.enterPatientFirstName(PATIENT_FIRST_NAME);
  await patientInformationPage.enterPatientDateOfBirth(PATIENT_DATE_OF_BIRTH);
  await patientInformationPage.selectPatientBirthSex(PATIENT_BIRTH_SEX);
  await patientInformationPage.enterStreetAddress(STREET_ADDRESS);
  await patientInformationPage.enterCity(CITY);
  await patientInformationPage.selectState(STATE);
  await patientInformationPage.enterPatientEmail(PATIENT_EMAIL);
  await patientInformationPage.enterPatientMobile(PATIENT_MOBILE);
  await patientInformationPage.selectPatientEthnicity(PATIENT_ETHNICITY);
  await patientInformationPage.selectPatientRace(PATIENT_RACE);
  await patientInformationPage.selectRelationship(RELATIONSHIP);
  await patientInformationPage.enterFullName(FULL_NAME);
  await patientInformationPage.enterDateOfBirthFromResponsibleContainer(BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.selectBirthSexFromResponsibleContainer(BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterPhoneFromResponsibleContainer(PHONE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO); 
  await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT); 
  await patientInformationPage.clickSaveChangesButton();
  await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
  await patientInformationPage.reloadPatientInformationPage();

  await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
  await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
  await patientInformationPage.verifyPatientDateOfBirth(PATIENT_DATE_OF_BIRTH);
  await patientInformationPage.verifyPatientBirthSex(PATIENT_BIRTH_SEX.toLowerCase());
  await patientInformationPage.verifyStreetAddress(STREET_ADDRESS);
  await patientInformationPage.verifyCity(CITY);
  await patientInformationPage.verifyState(STATE);
  await patientInformationPage.verifyPatientEmail(PATIENT_EMAIL);
  await patientInformationPage.verifyPatientMobile('+1'+ PATIENT_MOBILE);
  await patientInformationPage.verifyPatientEthnicity(PATIENT_ETHNICITY);
  await patientInformationPage.verifyPatientRace(PATIENT_RACE);
  await patientInformationPage.verifyRelationship(RELATIONSHIP);
  await patientInformationPage.verifyFullName(FULL_NAME);
  await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.verifyBirthSexFromResponsibleContainer(BIRTSEX_FROM_RESPONSIBLE_CONTAINER.toLowerCase());
  await patientInformationPage.verifyPhoneFromResponsibleContainer('+1'+ PHONE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.verifyReleaseOfInfo(RELEASE_OF_INFO); 
  await patientInformationPage.verifyRxHistoryConsent(RX_HISTORY_CONSENT); 
});