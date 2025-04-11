import { BrowserContext, Page, test } from '@playwright/test';
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
  chooseJson,
  CreateAppointmentResponse,
  DEMO_VISIT_CITY,
  DEMO_VISIT_MARKETING_MESSAGING,
  DEMO_VISIT_PATIENT_ETHNICITY,
  DEMO_VISIT_PATIENT_RACE,
  DEMO_VISIT_POINT_OF_DISCOVERY,
  DEMO_VISIT_PREFERRED_LANGUAGE,
  DEMO_VISIT_RESPONSIBLE_BIRTH_SEX,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR,
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
import { openAddPatientPage } from '../page/AddPatientPage';
import { waitForResponseWithData } from 'test-utils';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';

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
const NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const NEW_PHONE_FROM_RESPONSIBLE_CONTAINER = '(111) 111-1111';
//const RELEASE_OF_INFO = 'Yes, Release Allowed';
//const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';

let context: BrowserContext;
let page: Page;

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
  let appointmentIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    page.on('response', async (response) => {
      if (response.url().includes('/create-appointment/')) {
        const { appointment } = chooseJson(await response.json()) as CreateAppointmentResponse;
        if (appointment && !appointmentIds.includes(appointment)) {
          console.log('Created appointment: ', appointment);
          appointmentIds.push(appointment);
        }
      }
    });
  });

  test.beforeEach(async ({ page }) => {
    await resourceHandler.setResources();
    await page.waitForTimeout(2000);
    await page.goto('/patient/' + resourceHandler.patient.id);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
    for (const id of appointmentIds) {
      await resourceHandler.cleanAppointment(id);
    }
    appointmentIds = [];
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
    await patientInformationPage.enterZip(NEW_ZIP);
    await patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL);
    await patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE);
    await patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.selectPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.selectRelationshipFromResponsibleContainer(
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
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
    await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();

    await patientInformationPage.verifyRelationshipFromResponsibleContainer(
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.verifyFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
  });

  test('Check state, ethnicity, race, relationship to patient are required', async ({ page }) => {
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
    const appointmentId = response.appointment;
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
    await patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTSEX_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.clickSaveChangesButton();

    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_STATE);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PATIENT_ETHNICITY);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_PATIENT_RACE);
    await patientInformationPage.verifyValidationErrorShown(Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP);
  });

  test('Verify entered by patient data from Patient details block is displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyPatientEthnicity(DEMO_VISIT_PATIENT_ETHNICITY);
    await patientInformationPage.verifyPatientRace(DEMO_VISIT_PATIENT_RACE);
    await patientInformationPage.verifyHowDidYouHear(DEMO_VISIT_POINT_OF_DISCOVERY);
    await patientInformationPage.verifyMarketingMessaging(DEMO_VISIT_MARKETING_MESSAGING ? 'Yes' : 'No');
    await patientInformationPage.verifyPreferredLanguage(DEMO_VISIT_PREFERRED_LANGUAGE);
  });

  test('Updated values from Patient details  block  are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY);
    await patientInformationPage.selectPatientRace(NEW_PATIENT_RACE);
    await patientInformationPage.selectSexualOrientation(NEW_PATIENT_SEXUAL_ORIENTATION);
    await patientInformationPage.selectGenderIdentity(NEW_PATIENT_GENDER_IDENTITY);
    await patientInformationPage.selectHowDidYouHear(NEW_PATIENT_HOW_DID_YOU_HEAR);
    await patientInformationPage.selectMarketingMessaging(NEW_SEND_MARKETING_MESSAGES);
    await patientInformationPage.selectPreferredLanguage(NEW_PREFERRED_LANGUAGE);
    await patientInformationPage.selectCommonwellConsent(NEW_COMMON_WELL_CONSENT);

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
    await patientInformationPage.verifyCommonwellConsent(NEW_COMMON_WELL_CONSENT);
  });
});
