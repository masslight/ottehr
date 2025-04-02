import { test } from '@playwright/test';
import {
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';

import { expectPatientInformationPage, Field, openPatientInformationPage } from '../page/PatientInformationPage';
import { expectPatientRecordPage } from '../page/PatientRecordPage';
import {
  DEMO_VISIT_CITY,
  DEMO_VISIT_STATE,
  DEMO_VISIT_STREET_ADDRESS,
  DEMO_VISIT_STREET_ADDRESS_OPTIONAL,
  DEMO_VISIT_ZIP,
} from 'utils';

const resourceHandler = new ResourceHandler();
const NEW_PATIENT_LAST_NAME = 'Test_lastname';
const NEW_PATIENT_FIRST_NAME = 'Test_firstname';
const NEW_PATIENT_MIDDLE_NAME = 'Test_middle';
const NEW_PATIENT_SUFFIX = 'Mrs';
const NEW_PATIENT_PREFERRED_NAME = 'Test_pref';
const NEW_PATIENT_DATE_OF_BIRTH = '01/01/2024';
const NEW_PATIENT_PREFERRED_PRONOUNS = 'They/them';
const NEW_PATIENT_BIRTH_SEX = 'Female';
const NEW_STREET_ADDRESS = 'Test address, 1';
const NEW_STREET_ADDRESS_OPTIONAL = 'test, optional';
const NEW_CITY = 'New York';
const NEW_STATE = 'CA';
const NEW_ZIP = '05000';
const NEW_PATIENT_EMAIL = 'testemail@getMaxListeners.com';
const NEW_PATIENT_MOBILE = '2027139680';
const NEW_PATIENT_ETHNICITY = 'Hispanic or Latino';
const NEW_PATIENT_RACE = 'Asian';
const NEW_RELATIONSHIP = 'Parent';
const NEW_FIRST_NAME = 'First name';
const NEW_LAST_NAME = 'Last name';
const NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
const NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const NEW_PHONE_FROM_RESPONSIBLE_CONTAINER = '1111111111';
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

  test('Fill and save required values on Patient Info Page, values are saved and updated successfully- Happy path', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientLastName(NEW_PATIENT_LAST_NAME);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.enterPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.selectPatientBirthSex(NEW_PATIENT_BIRTH_SEX);
    await patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS);
    await patientInformationPage.enterCity(NEW_CITY);
    await patientInformationPage.selectState(NEW_STATE);
    await patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE);
    await patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.selectPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.selectRelationship(NEW_RELATIONSHIP);
    await patientInformationPage.enterFirstName(NEW_FIRST_NAME);
    await patientInformationPage.enterLastName(NEW_LAST_NAME);
    await patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
    // await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO);
    // await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT);
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyPatientLastName(NEW_PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.verifyPatientBirthSex(NEW_PATIENT_BIRTH_SEX);
    await patientInformationPage.verifyStreetAddress(NEW_STREET_ADDRESS);
    await patientInformationPage.verifyCity(NEW_CITY);
    await patientInformationPage.verifyState(NEW_STATE);
    await patientInformationPage.verifyPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.verifyPatientMobile(NEW_PATIENT_MOBILE);
    await patientInformationPage.verifyPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.verifyRelationship(NEW_RELATIONSHIP);
    await patientInformationPage.verifyFirstName(NEW_FIRST_NAME);
    await patientInformationPage.verifyLastName(NEW_LAST_NAME);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);

    /*
    skipping these tests because this component has been hidden while await requirement clarification from product team
    await patientInformationPage.verifyReleaseOfInfo(RELEASE_OF_INFO);
    await patientInformationPage.verifyRxHistoryConsent(RX_HISTORY_CONSENT);
    */
  });

  test('Verify required data from Patient info block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientInformationPage.verifyPatientBirthSex(PATIENT_GENDER);
  });

  test('Check validation error is displayed if any required field in Patient info block is missing', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clearPatientLastName();
    await patientInformationPage.clearPatientFirstName();
    await patientInformationPage.clearPatientDateOfBirth();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.PATIENT_LAST_NAME);
    await patientInformationPage.verifyValidationErrorShown(Field.PATIENT_FIRST_NAME);
    await patientInformationPage.verifyValidationErrorShown(Field.PATIENT_DOB);
  });
  test('Updated values from Patient info block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientLastName(NEW_PATIENT_LAST_NAME);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.enterPatientMiddleName(NEW_PATIENT_MIDDLE_NAME);
    await patientInformationPage.enterPatientSuffix(NEW_PATIENT_SUFFIX);
    await patientInformationPage.enterPatientPreferredName(NEW_PATIENT_PREFERRED_NAME);
    await patientInformationPage.enterPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.selectPatientPreferredPronouns(NEW_PATIENT_PREFERRED_PRONOUNS);
    await patientInformationPage.selectPatientBirthSex(NEW_PATIENT_BIRTH_SEX);

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyPatientLastName(NEW_PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientMiddleName(NEW_PATIENT_MIDDLE_NAME);
    await patientInformationPage.verifyPatientSuffix(NEW_PATIENT_SUFFIX);
    await patientInformationPage.verifyPatientPreferredName(NEW_PATIENT_PREFERRED_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.verifyPatientPreferredPronouns(NEW_PATIENT_PREFERRED_PRONOUNS);
    await patientInformationPage.verifyPatientBirthSex(NEW_PATIENT_BIRTH_SEX);
  });

  test('Verify required data from Contact info block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyStreetAddress(DEMO_VISIT_STREET_ADDRESS);
    await patientInformationPage.verifyAddressLineOptional(DEMO_VISIT_STREET_ADDRESS_OPTIONAL);
    await patientInformationPage.verifyCity(DEMO_VISIT_CITY);
    await patientInformationPage.verifyState(DEMO_VISIT_STATE);
    await patientInformationPage.verifyZip(DEMO_VISIT_ZIP);
    await patientInformationPage.verifyPatientEmail(PATIENT_EMAIL);
    await patientInformationPage.verifyPatientMobile(PATIENT_PHONE_NUMBER);
  });

  test('Check validation error is displayed if any required field in Contact info block is missing', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clearStreetAdress();
    await patientInformationPage.clearCity();
    await patientInformationPage.clearZip();
    await patientInformationPage.clearPatientEmail();
    await patientInformationPage.clearPatientMobile();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_STREET_ADDRESS);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_CITY);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_ZIP);
    await patientInformationPage.verifyValidationErrorShown(Field.PATIENT_EMAIL);
    await patientInformationPage.verifyValidationErrorShown(Field.PATIENT_PHONE_NUMBER);
  });

  test('Enter invalid email,zip and mobile on Contract info block, validation errors are shown', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterZip('11');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorZipField();
    await patientInformationPage.enterZip('11223344');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorZipField();
    await patientInformationPage.enterPatientEmail('testemailgetMaxListeners.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.enterPatientEmail('@testemailgetMaxListeners.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.enterPatientEmail('testemailgetMaxListeners@.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.clearPatientMobile();
    await patientInformationPage.enterPatientMobile('111');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidMobile();
  });

  test('Updated values from Contact info block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS);
    await patientInformationPage.enterAddressLineOptional(NEW_STREET_ADDRESS_OPTIONAL);
    await patientInformationPage.enterCity(NEW_CITY);
    await patientInformationPage.selectState(NEW_STATE);
    await patientInformationPage.enterZip(NEW_ZIP);
    await patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE);

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyStreetAddress(NEW_STREET_ADDRESS);
    await patientInformationPage.verifyAddressLineOptional(NEW_STREET_ADDRESS_OPTIONAL);
    await patientInformationPage.verifyCity(NEW_CITY);
    await patientInformationPage.verifyState(NEW_STATE);
    await patientInformationPage.verifyZip(NEW_ZIP);
    await patientInformationPage.verifyPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.verifyPatientMobile(NEW_PATIENT_MOBILE);
  });
});
