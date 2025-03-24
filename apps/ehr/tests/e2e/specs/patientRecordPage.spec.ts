import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

import { expectPatientInformationPage, openPatientInformationPage } from '../page/PatientInformationPage';
import { expectPatientRecordPage } from '../page/PatientRecordPage';

const resourceHandler = new ResourceHandler();
const PATIENT_LAST_NAME = 'Test_lastname';
const PATIENT_FIRST_NAME = 'Test_firstname';
const PATIENT_DATE_OF_BIRTH = '01/01/2024';
const PATIENT_BIRTH_SEX = 'Female';
const STREET_ADDRESS = 'Test address, 1';
const CITY = 'New York';
const STATE = 'CA';
const PATIENT_EMAIL = 'testemail@getMaxListeners.com';
const PATIENT_MOBILE = '(120) 271-3968';
const PATIENT_ETHNICITY = 'Hispanic or Latino';
const PATIENT_RACE = 'Asian';
const RELATIONSHIP = 'Parent';
const FIRST_NAME = 'First name';
const LAST_NAME = 'Last name';
const BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
const BIRTSEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const PHONE_FROM_RESPONSIBLE_CONTAINER = '(111) 111-1111';
//const RELEASE_OF_INFO = 'Yes, Release Allowed';
//const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';

test.describe('Patient Record Page non-mutating tests', () => {
  test.beforeAll(async () => {
    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.goto('/patient/' + resourceHandler.patient.id);
  });

  test('Click on "See all patient info button", Patient Info Page is opened', async ({ page }) => {
    const patientRecordPage = await expectPatientRecordPage(resourceHandler.patient.id!, page);
    await patientRecordPage.clickSeeAllPatientInfoButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
  });
});

test.describe('Patient Record Page mutating tests', () => {
  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await page.waitForTimeout(2000);
    await page.goto('/patient/' + resourceHandler.patient.id);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Fill and save required values on Patient Info Page, values are saved and updated successfully', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
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
    await patientInformationPage.enterFirstName(FIRST_NAME);
    await patientInformationPage.enterLastName(LAST_NAME);
    await patientInformationPage.enterDateOfBirthFromResponsibleContainer(BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.selectBirthSexFromResponsibleContainer(BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterPhoneFromResponsibleContainer(PHONE_FROM_RESPONSIBLE_CONTAINER);
    // await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO);
    // await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT);
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.verifyPatientBirthSex(PATIENT_BIRTH_SEX);
    await patientInformationPage.verifyStreetAddress(STREET_ADDRESS);
    await patientInformationPage.verifyCity(CITY);
    await patientInformationPage.verifyState(STATE);
    await patientInformationPage.verifyPatientEmail(PATIENT_EMAIL);
    await patientInformationPage.verifyPatientMobile(PATIENT_MOBILE);
    await patientInformationPage.verifyPatientEthnicity(PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(PATIENT_RACE);
    await patientInformationPage.verifyRelationship(RELATIONSHIP);
    await patientInformationPage.verifyFirstName(FIRST_NAME);
    await patientInformationPage.verifyLastName(LAST_NAME);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(PHONE_FROM_RESPONSIBLE_CONTAINER);

    /*
    skipping these tests because this component has been hidden while await requirement clarification from product team
    await patientInformationPage.verifyReleaseOfInfo(RELEASE_OF_INFO);
    await patientInformationPage.verifyRxHistoryConsent(RX_HISTORY_CONSENT);
    */
  });
});
