import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForResponseWithData } from 'test-utils';
import {
  CreateAppointmentResponse,
  DEMO_VISIT_CITY,
  DEMO_VISIT_MARKETING_MESSAGING,
  DEMO_VISIT_PATIENT_ETHNICITY,
  DEMO_VISIT_PATIENT_RACE,
  DEMO_VISIT_PHYSICIAN_ADDRESS,
  DEMO_VISIT_PHYSICIAN_MOBILE,
  DEMO_VISIT_POINT_OF_DISCOVERY,
  DEMO_VISIT_PRACTICE_NAME,
  DEMO_VISIT_PREFERRED_LANGUAGE,
  DEMO_VISIT_PROVIDER_FIRST_NAME,
  DEMO_VISIT_PROVIDER_LAST_NAME,
  DEMO_VISIT_RESPONSIBLE_BIRTH_SEX,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR,
  DEMO_VISIT_RESPONSIBLE_EMAIL,
  DEMO_VISIT_RESPONSIBLE_FIRST_NAME,
  DEMO_VISIT_RESPONSIBLE_LAST_NAME,
  DEMO_VISIT_RESPONSIBLE_PHONE,
  DEMO_VISIT_RESPONSIBLE_RELATIONSHIP,
  DEMO_VISIT_STATE,
  DEMO_VISIT_STREET_ADDRESS,
  DEMO_VISIT_STREET_ADDRESS_OPTIONAL,
  DEMO_VISIT_ZIP,
  unpackFhirResponse,
} from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import {
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { openAddPatientPage } from '../page/AddPatientPage';
import { expectDiscardChangesDialog } from '../page/patient-information/DiscardChangesDialog';
import {
  expectPatientInformationPage,
  Field,
  openPatientInformationPage,
  PatientInformationPage,
} from '../page/PatientInformationPage';
import { expectPatientRecordPage } from '../page/PatientRecordPage';
import { expectPatientsPage } from '../page/PatientsPage';

const NEW_PATIENT_LAST_NAME = 'Test_last_name';
const NEW_PATIENT_FIRST_NAME = 'Test_first_name';
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
const NEW_PATIENT_SEXUAL_ORIENTATION = 'Straight';
const NEW_PATIENT_GENDER_IDENTITY = 'Female';
const NEW_PATIENT_HOW_DID_YOU_HEAR = 'Webinar';
const NEW_SEND_MARKETING_MESSAGES = 'No';
const NEW_PREFERRED_LANGUAGE = 'Spanish';
const NEW_COMMON_WELL_CONSENT = 'Yes';
const NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER = 'Parent';
const NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER = 'First name';
const NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER = 'Last name';
const NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
const NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const NEW_PHONE_FROM_RESPONSIBLE_CONTAINER = '(202) 111-1111';
const NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER = 'rowdyroddypiper@hotmail.com';
const NEW_ADDRESS_RESPONSIBLE_PARTY = '123 fake lane';
const NEW_CITY_RESPONSIBLE_PARTY = 'Los Angeles';
const NEW_STATE_RESPONSIBLE_PARTY = 'NY';
const NEW_ZIP_RESPONSIBLE_PARTY = '10003';
const NEW_PROVIDER_FIRST_NAME = 'John';
const NEW_PROVIDER_LAST_NAME = 'Doe';
const NEW_PRACTICE_NAME = 'Dental';
const NEW_PHYSICIAN_ADDRESS = '5th avenue';
const NEW_PHYSICIAN_MOBILE = '(202) 222-2222';
const NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD = 'testing gender';

//const RELEASE_OF_INFO = 'Yes, Release Allowed';
//const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';

const populateAllRequiredFields = async (patientInformationPage: PatientInformationPage): Promise<void> => {
  await patientInformationPage.enterPatientLastName(NEW_PATIENT_LAST_NAME);

  await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
  await patientInformationPage.enterPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
  await patientInformationPage.selectPatientBirthSex(NEW_PATIENT_BIRTH_SEX);
  await patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS);
  await patientInformationPage.enterCity(NEW_CITY);
  await patientInformationPage.selectState(NEW_STATE);
  await patientInformationPage.enterZip(NEW_ZIP);
  await patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL);
  await patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE);
  await patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY);
  await patientInformationPage.selectPatientRace(NEW_PATIENT_RACE);
  await patientInformationPage.selectRelationshipFromResponsibleContainer(NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterEmailFromResponsibleContainer(NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER);
  await patientInformationPage.enterStreetLine1FromResponsibleContainer(NEW_ADDRESS_RESPONSIBLE_PARTY);
  await patientInformationPage.enterResponsiblePartyCity(NEW_CITY_RESPONSIBLE_PARTY);
  await patientInformationPage.selectResponsiblePartyState(NEW_STATE_RESPONSIBLE_PARTY);
  await patientInformationPage.enterResponsiblePartyZip(NEW_ZIP_RESPONSIBLE_PARTY);
};

test.describe('Patient Record Page non-mutating tests', () => {
  const PROCESS_ID = `patientRecordPage-non-mutating-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID);

  test.beforeAll(async () => {
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!);
    }
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Click on "See all patient info button", Patient Info Page is opened', async ({ page }) => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    const patientRecordPage = await expectPatientRecordPage(resourceHandler.patient.id!, page);
    await patientRecordPage.clickSeeAllPatientInfoButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
  });

  test('Verify required data from Patient info block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientLastName(PATIENT_LAST_NAME);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.verifyPatientDateOfBirth(PATIENT_BIRTH_DATE_SHORT);
    await patientInformationPage.verifyPatientBirthSex(PATIENT_GENDER);
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

  test('Verify data from Responsible party information block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyRelationshipFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_RELATIONSHIP);
    await patientInformationPage.verifyFirstNameFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_FIRST_NAME);
    await patientInformationPage.verifyLastNameFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_LAST_NAME);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(
      DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH +
        '/' +
        DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY +
        '/' +
        DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR
    );
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_BIRTH_SEX);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_PHONE);
    await patientInformationPage.verifyEmailFromResponsibleContainer(DEMO_VISIT_RESPONSIBLE_EMAIL);
  });

  test('Verify entered by patient data from Patient details block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientEthnicity(DEMO_VISIT_PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(DEMO_VISIT_PATIENT_RACE);
    await patientInformationPage.verifyHowDidYouHear(DEMO_VISIT_POINT_OF_DISCOVERY);
    await patientInformationPage.verifyMarketingMessaging(DEMO_VISIT_MARKETING_MESSAGING ? 'Yes' : 'No');
    await patientInformationPage.verifyPreferredLanguage(DEMO_VISIT_PREFERRED_LANGUAGE);
  });

  test('Verify data from Primary Care Physician block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyFirstNameFromPcp(DEMO_VISIT_PROVIDER_FIRST_NAME);
    await patientInformationPage.verifyLastNameFromPcp(DEMO_VISIT_PROVIDER_LAST_NAME);
    await patientInformationPage.verifyPracticeNameFromPcp(DEMO_VISIT_PRACTICE_NAME);
    await patientInformationPage.verifyAddressFromPcp(DEMO_VISIT_PHYSICIAN_ADDRESS);
    await patientInformationPage.verifyMobileFromPcp(DEMO_VISIT_PHYSICIAN_MOBILE);
  });

  test('Check all fields from Primary Care Physician block are hidden when checkbox is checked', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.setCheckboxOn();
    await patientInformationPage.verifyFirstNameFromPcpIsNotVisible();
    await patientInformationPage.verifyLastNameFromPcpIsNotVisible();
    await patientInformationPage.verifyPracticeNameFromPcpIsNotVisible();
    await patientInformationPage.verifyAddressFromPcpIsNotVisible();
    await patientInformationPage.verifyMobileFromPcpIsNotVisible();
  });

  test.skip('Check all fields from Primary Care Physician block after toggling the checkbox on and off', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);

    await patientInformationPage.setCheckboxOn();
    await patientInformationPage.setCheckboxOff();

    await patientInformationPage.verifyFirstNameFromPcp(DEMO_VISIT_PROVIDER_FIRST_NAME);
    await patientInformationPage.verifyLastNameFromPcp(DEMO_VISIT_PROVIDER_LAST_NAME);
    await patientInformationPage.verifyPracticeNameFromPcp(DEMO_VISIT_PRACTICE_NAME);
    await patientInformationPage.verifyAddressFromPcp(DEMO_VISIT_PHYSICIAN_ADDRESS);
    await patientInformationPage.verifyMobileFromPcp(DEMO_VISIT_PHYSICIAN_MOBILE);
  });

  test('Check validation error is displayed for invalid phone number from Primary Care Physician block', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clearMobileFromPcp();
    await patientInformationPage.enterMobileFromPcp('2222245');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidPhoneFromPcp();
  });

  //to do: uncomment when https://github.com/masslight/ottehr/issues/2200 will be fixed
  /* test('Click [x] from Patient info page without updating any data, Patient Record page is opened', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickCloseButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });

  test('Click [x] from Patient info page after updating any field and reverting this changes, Patient Record page is opened', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.enterPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });*/

  test('Click on Patients Name breadcrumb, Patient Record page is opened', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickPatientNameBreadcrumb(
      resourceHandler.patient.name?.[0]?.given?.[0] + ' ' + resourceHandler.patient.name?.[0].family
    );
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });

  test('Click on Patients breadcrumb, Patients page is opened', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickPatientsBreadcrumb();
    await expectPatientsPage(page);
  });

  test('Click on [Discard changes] button, Patient Record page is opened', async ({ page }) => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    let patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickDiscardChangesButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
    patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(PATIENT_FIRST_NAME);
  });

  test('Click on [Cancel] button, user stays on Patient Profile page', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickCancelButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
  });

  test('Click on [x] icon, user stays on Patient Profile page', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDiscardChangesDialog(page);
    await discardChangesDialog.clickCloseButton();
    await expectPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME);
  });
});

test.describe('Patient Record Page mutating tests', () => {
  const PROCESS_ID = `patientRecordPage-mutating-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID);

  test.beforeEach(async () => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Fill and save required values on Patient Info Page, values are saved and updated successfully- Happy path', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await populateAllRequiredFields(patientInformationPage);
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
    await patientInformationPage.verifyZip(NEW_ZIP);
    await patientInformationPage.verifyPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.verifyPatientMobile(NEW_PATIENT_MOBILE);
    await patientInformationPage.verifyPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.verifyRelationshipFromResponsibleContainer(
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.verifyFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyEmailFromResponsibleContainer(NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER);

    /*
    skipping these tests because this component has been hidden while await requirement clarification from product team
    await patientInformationPage.verifyReleaseOfInfo(RELEASE_OF_INFO);
    await patientInformationPage.verifyRxHistoryConsent(RX_HISTORY_CONSENT);
    */
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
    await populateAllRequiredFields(patientInformationPage);
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

  test('Check validation error is displayed if any required field in Contact info block is missing', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clearStreetAddress();
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
    await patientInformationPage.enterPatientEmail('testEmailGetMaxListeners.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.enterPatientEmail('@testEmailGetMaxListeners.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.enterPatientEmail('testEmailGetMaxListeners@.com');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidEmail();
    await patientInformationPage.clearPatientMobile();
    await patientInformationPage.enterPatientMobile('111');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidMobile();
  });

  test('Updated values from Contact info block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await populateAllRequiredFields(patientInformationPage);

    await patientInformationPage.enterAddressLineOptional(NEW_STREET_ADDRESS_OPTIONAL);
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

  test('Check validation error is displayed if any required field in Responsible party information block is missing or phone number is invalid', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clearFirstNameFromResponsibleContainer();
    await patientInformationPage.clearLastNameFromResponsibleContainer();
    await patientInformationPage.clearDateOfBirthFromResponsibleContainer();
    await patientInformationPage.clearPhoneFromResponsibleContainer();
    await patientInformationPage.clickSaveChangesButton();

    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_RESPONSIBLE_FIRST_NAME);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_RESPONSIBLE_LAST_NAME);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_RESPONSIBLE_BIRTHDATE);
    await patientInformationPage.enterPhoneFromResponsibleContainer('111');
    await patientInformationPage.enterDateOfBirthFromResponsibleContainer('10/10/2024');
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidPhoneFromResponsibleContainer();
  });

  test('Updated values from Responsible party information block  are saved and displayed correctly', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.selectRelationshipFromResponsibleContainer(
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterEmailFromResponsibleContainer(NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyRelationshipFromResponsibleContainer(
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.verifyFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyEmailFromResponsibleContainer(NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER);
  });

  test('Updated values from Patient details  block  are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await populateAllRequiredFields(patientInformationPage);

    await patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.selectPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.selectSexualOrientation(NEW_PATIENT_SEXUAL_ORIENTATION);
    await patientInformationPage.selectGenderIdentity(NEW_PATIENT_GENDER_IDENTITY);
    await patientInformationPage.selectHowDidYouHear(NEW_PATIENT_HOW_DID_YOU_HEAR);
    await patientInformationPage.selectMarketingMessaging(NEW_SEND_MARKETING_MESSAGES);
    await patientInformationPage.selectPreferredLanguage(NEW_PREFERRED_LANGUAGE);
    await patientInformationPage.selectCommonWellConsent(NEW_COMMON_WELL_CONSENT);

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.verifySexualOrientation(NEW_PATIENT_SEXUAL_ORIENTATION);
    await patientInformationPage.verifyGenderIdentity(NEW_PATIENT_GENDER_IDENTITY);
    await patientInformationPage.verifyHowDidYouHear(NEW_PATIENT_HOW_DID_YOU_HEAR);
    await patientInformationPage.verifyMarketingMessaging(NEW_SEND_MARKETING_MESSAGES);
    await patientInformationPage.verifyPreferredLanguage(NEW_PREFERRED_LANGUAGE);
    await patientInformationPage.verifyCommonWellConsent(NEW_COMMON_WELL_CONSENT);
  });

  test('If "Other" gender is selected from Patient details  block, additional field appears and it is required', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await populateAllRequiredFields(patientInformationPage);
    await patientInformationPage.selectGenderIdentity('Other');
    await patientInformationPage.verifyOtherGenderFieldIsVisible();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.GENDER_IDENTITY_ADDITIONAL_FIELD);
    await patientInformationPage.enterOtherGenderField(NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD);
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    await patientInformationPage.verifyGenderIdentity('Other');
    await patientInformationPage.verifyOtherGenderInput(NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD);
    await patientInformationPage.selectGenderIdentity(NEW_PATIENT_GENDER_IDENTITY);
    await patientInformationPage.verifyOtherGenderFieldIsNotVisible();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    await patientInformationPage.verifyGenderIdentity(NEW_PATIENT_GENDER_IDENTITY);
    await patientInformationPage.verifyOtherGenderFieldIsNotVisible();
  });

  test('Check all fields from Primary Care Physician block are visible and required when checkbox is unchecked', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyCheckboxOff();
    await patientInformationPage.verifyFirstNameFromPcpIsVisible();
    await patientInformationPage.verifyLastNameFromPcpIsVisible();
    await patientInformationPage.verifyPracticeNameFromPcpIsVisible();
    await patientInformationPage.verifyAddressFromPcpIsVisible();
    await patientInformationPage.verifyMobileFromPcpIsVisible();

    await patientInformationPage.clearFirstNameFromPcp();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PROVIDER_FIRST_NAME);

    await patientInformationPage.enterFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME);
    await patientInformationPage.clearLastNameFromPcp();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PROVIDER_LAST_NAME);

    await patientInformationPage.enterLastNameFromPcp(NEW_PROVIDER_LAST_NAME);
    await patientInformationPage.clearPracticeNameFromPcp();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PRACTICE_NAME);

    await patientInformationPage.enterPracticeNameFromPcp(NEW_PRACTICE_NAME);
    await patientInformationPage.clearAddressFromPcp();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PHYSICIAN_ADDRESS);

    await patientInformationPage.enterAddressFromPcp(NEW_PHYSICIAN_ADDRESS);
    await patientInformationPage.clearMobileFromPcp();
    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyValidationErrorInvalidPhoneFromPcp();
  });

  test('Updated values from Primary Care Physician block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await populateAllRequiredFields(patientInformationPage);
    await patientInformationPage.enterFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME);
    await patientInformationPage.enterLastNameFromPcp(NEW_PROVIDER_LAST_NAME);
    await patientInformationPage.enterPracticeNameFromPcp(NEW_PRACTICE_NAME);
    await patientInformationPage.enterAddressFromPcp(NEW_PHYSICIAN_ADDRESS);
    await patientInformationPage.enterMobileFromPcp(NEW_PHYSICIAN_MOBILE);

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME);
    await patientInformationPage.verifyLastNameFromPcp(NEW_PROVIDER_LAST_NAME);
    await patientInformationPage.verifyPracticeNameFromPcp(NEW_PRACTICE_NAME);
    await patientInformationPage.verifyAddressFromPcp(NEW_PHYSICIAN_ADDRESS);
    await patientInformationPage.verifyMobileFromPcp(NEW_PHYSICIAN_MOBILE);
  });

  const INSURANCE_PLAN_TYPE = '09 - Self Pay';
  const INSURANCE_MEMBER_ID = 'abc1234567';
  const INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
  const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
  const INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
  const INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
  const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
  const INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
  const INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannoli';
  const INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
  const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
  const INSURANCE_POLICY_HOLDER_STATE = 'AK';
  const INSURANCE_POLICY_HOLDER_ZIP = '78956';
  const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
  const INSURANCE_CARRIER = '6 Degrees Health Incorporated';

  const INSURANCE_PLAN_TYPE_2 = '12 - PPO';
  const INSURANCE_MEMBER_ID_2 = '987548ert';
  const INSURANCE_POLICY_HOLDER_ADDRESS_2 = 'second street';
  const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2 = 'additional2';
  const INSURANCE_POLICY_HOLDER_BIRTH_SEX_2 = 'Male';
  const INSURANCE_POLICY_HOLDER_CITY_2 = 'Denver';
  const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2 = '03/03/1991';
  const INSURANCE_POLICY_HOLDER_FIRST_NAME_2 = 'David';
  const INSURANCE_POLICY_HOLDER_LAST_NAME_2 = 'Sorbet';
  const INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2 = 'Roger';
  const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2 = 'Injured Party';
  const INSURANCE_POLICY_HOLDER_STATE_2 = 'CO';
  const INSURANCE_POLICY_HOLDER_ZIP_2 = '21211';
  const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2 = 'testing2';
  const INSURANCE_CARRIER_2 = 'ACTIN Care Groups';

  test('Check validation error is displayed if any required field in Add insurance dialog is missing', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();

    await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);
    await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);
    await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);
    await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
    await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);
    await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);
    await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP);
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.insuranceCarrier);
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersSex);
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.relationship);
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.state);

    await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER);
    await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX);
    await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
    await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE);

    await addInsuranceDialog.clearMemberId();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.memberId);
    await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);

    await addInsuranceDialog.clearPolicyHolderFirstName();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersFirstName);
    await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);

    await addInsuranceDialog.clearPolicyHolderLastName();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersLastName);
    await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);

    await addInsuranceDialog.clearDateOfBirthFromAddInsuranceDialog();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth);
    await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);

    await addInsuranceDialog.clearPolicyHolderStreetAddress();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.streetAddress);
    await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);

    await addInsuranceDialog.clearPolicyHolderCity();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.city);
    await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);

    await addInsuranceDialog.clearZipFromAddInsuranceDialog();
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.zip);
  });

  test('Check validation error is displayed for invalid zip', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.enterZipFromAddInsuranceDialog('11');
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance();
    await addInsuranceDialog.enterZipFromAddInsuranceDialog('11223344');
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
    await addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance();
  });

  test('Fill fields and add primary and secondary insurances, verify insurances are saved successfully with correct data', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.selectInsuranceType('Primary');
    await addInsuranceDialog.selectPlanType(INSURANCE_PLAN_TYPE);
    await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);
    await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);
    await addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
    await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);
    await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
    await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);
    await addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE);
    await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);
    await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP);
    await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER);
    await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX);
    await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
    await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE);
    await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.verifyInsuranceType('Primary');
    await primaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER);
    await primaryInsuranceCard.verifyPlanType(INSURANCE_PLAN_TYPE);
    await primaryInsuranceCard.verifyMemberId(INSURANCE_MEMBER_ID);
    await primaryInsuranceCard.verifyPolicyHoldersFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
    await primaryInsuranceCard.verifyPolicyHoldersSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX);
    await primaryInsuranceCard.verifyInsuranceStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);
    await primaryInsuranceCard.verifyInsuranceAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE);
    await primaryInsuranceCard.verifyInsuranceCity(INSURANCE_POLICY_HOLDER_CITY);
    await primaryInsuranceCard.verifyInsuranceState(INSURANCE_POLICY_HOLDER_STATE);
    await primaryInsuranceCard.verifyInsuranceZip(INSURANCE_POLICY_HOLDER_ZIP);
    await primaryInsuranceCard.verifyPatientsRelationshipToInjured(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
    await primaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);

    await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.verifyTypeField('Secondary', false);
    await addInsuranceDialog.selectPlanType(INSURANCE_PLAN_TYPE_2);
    await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID_2);
    await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME_2);
    await addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2);
    await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME_2);
    await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2);
    await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS_2);
    await addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2);
    await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY_2);
    await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP_2);
    await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER_2);
    await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX_2);
    await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2);
    await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE_2);
    await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2);
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.verifyInsuranceType('Secondary');
    await secondaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER_2);
    await secondaryInsuranceCard.verifyPlanType(INSURANCE_PLAN_TYPE_2);
    await secondaryInsuranceCard.verifyMemberId(INSURANCE_MEMBER_ID_2);
    await secondaryInsuranceCard.verifyPolicyHoldersFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME_2);
    await secondaryInsuranceCard.verifyPolicyHoldersLastName(INSURANCE_POLICY_HOLDER_LAST_NAME_2);
    await secondaryInsuranceCard.verifyPolicyHoldersMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2);
    await secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2);
    await secondaryInsuranceCard.verifyPolicyHoldersSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX_2);
    await secondaryInsuranceCard.verifyInsuranceStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS_2);
    await secondaryInsuranceCard.verifyInsuranceAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2);
    await secondaryInsuranceCard.verifyInsuranceCity(INSURANCE_POLICY_HOLDER_CITY_2);
    await secondaryInsuranceCard.verifyInsuranceState(INSURANCE_POLICY_HOLDER_STATE_2);
    await secondaryInsuranceCard.verifyInsuranceZip(INSURANCE_POLICY_HOLDER_ZIP_2);
    await secondaryInsuranceCard.verifyPatientsRelationshipToInjured(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2);
    await secondaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2);
  });
});

test.describe('Patient Record Page tests with zero patient data filled in', async () => {
  const PROCESS_ID = `patientRecordPage-zero-data-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Check state, ethnicity, race, relationship to patient are required', async () => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    const addPatientPage = await openAddPatientPage(page);
    await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
    await addPatientPage.enterMobilePhone(NEW_PATIENT_MOBILE);
    await addPatientPage.clickSearchForPatientsButton();
    await addPatientPage.clickPatientNotFoundButton();
    await addPatientPage.enterFirstName(NEW_PATIENT_FIRST_NAME);
    await addPatientPage.enterLastName(NEW_PATIENT_FIRST_NAME);
    await addPatientPage.enterDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await addPatientPage.selectSexAtBirth(NEW_PATIENT_BIRTH_SEX);
    await addPatientPage.selectReasonForVisit('Injury to head');
    await addPatientPage.selectVisitType('Walk-in In Person Visit');
    const appointmentCreationResponse = waitForResponseWithData(page, /\/create-appointment\//);
    await addPatientPage.clickAddButton();

    const response = await unpackFhirResponse<CreateAppointmentResponse>(await appointmentCreationResponse);
    const appointmentId = response.appointmentId;
    if (!appointmentId) {
      throw new Error('Appointment ID should be present in the response');
    }

    const patientId = await resourceHandler.patientIdByAppointmentId(appointmentId);
    const patientInformationPage = await openPatientInformationPage(page, patientId);
    await patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS);
    await patientInformationPage.enterCity(NEW_CITY);
    await patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE);
    await patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.clickSaveChangesButton();

    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_STATE);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PATIENT_ETHNICITY);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PATIENT_RACE);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP);
  });
});
