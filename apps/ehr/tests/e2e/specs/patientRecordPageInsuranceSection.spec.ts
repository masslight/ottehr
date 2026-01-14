import { test } from '@playwright/test';
import { Organization, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createReference,
  getAttorneyInformationStepAnswers,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getEmergencyContactStepAnswers,
  getEmployerInformationStepAnswers,
  getPatientDetailsStepAnswers,
  getPayerId,
  getPaymentOptionInsuranceAnswers,
  getPrimaryCarePhysicianStepAnswers,
  getResponsiblePartyStepAnswers,
  hasAttorneyInformationPage,
  hasEmployerInformationPage,
  isoToDateObject,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  PATIENT_RECORD_CONFIG,
} from 'utils';
import {
  PATIENT_INSURANCE_MEMBER_ID,
  PATIENT_INSURANCE_MEMBER_ID_2,
  PATIENT_INSURANCE_PLAN_TYPE,
  PATIENT_INSURANCE_PLAN_TYPE_2,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT,
  PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX,
  PATIENT_INSURANCE_POLICY_HOLDER_2_CITY,
  PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH,
  PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED,
  PATIENT_INSURANCE_POLICY_HOLDER_2_STATE,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT,
  PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX,
  PATIENT_INSURANCE_POLICY_HOLDER_CITY,
  PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH,
  PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED,
  PATIENT_INSURANCE_POLICY_HOLDER_STATE,
  PATIENT_INSURANCE_POLICY_HOLDER_ZIP,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { openPatientInformationPage } from '../page/PatientInformationPage';

const POLICY_HOLDER_DATE_OF_BIRTH = '01/01/1990';
const POLICY_HOLDER_2_DATE_OF_BIRTH = '01/01/1991';
const NEW_PATIENT_INSURANCE_MEMBER_ID = 'abc1234567';
const NEW_PATIENT_INSURANCE_MEMBER_ID_2 = '125897ftr';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS = 'street 21';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE = 'additional2';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX = 'Intersex';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY = 'Las Vegas';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH = '03/03/1993';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME = 'Alice';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME = 'Wonder';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME = 'Louisa';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED = 'Child';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE = 'NJ';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP = '32567';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannoli';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE = 'AK';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP = '78956';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
const NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2 = 'testing2';
const NEW_PATIENT_INSURANCE_CARRIER = '20446 - 6 Degrees Health Incorporated';
const NEW_PATIENT_INSURANCE_PLAN_TYPE = '11 - Other Non-Federal Programs';
const NEW_PATIENT_INSURANCE_CARRIER_2 = '11983 - AAA - Minnesota/Iowa';
const NEW_PATIENT_INSURANCE_PLAN_TYPE_2 = '14 - EPO';

const insuranceSection = PATIENT_RECORD_CONFIG.FormFields.insurance;

test.describe('Insurance Information Section non-mutating tests', () => {
  let resourceHandler: ResourceHandler;
  let primaryInsuranceCarrier: string;
  let secondaryInsuranceCarrier: string;

  test.beforeAll(async () => {
    const [createdResourceHandler, createdPrimaryInsuranceCarrier, createdSecondaryInsuranceCarrier] =
      await createResourceHandler();
    resourceHandler = createdResourceHandler;
    primaryInsuranceCarrier = createdPrimaryInsuranceCarrier;
    secondaryInsuranceCarrier = createdSecondaryInsuranceCarrier;
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test(
    'Verify data from Primary and Secondary Insurances blocks are displayed correctly',
    { tag: '@flaky' },
    async ({ page }) => {
      const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
      const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await primaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await primaryInsuranceCard.verifyInsuranceType('Primary');
      await primaryInsuranceCard.verifyInsuranceCarrier(primaryInsuranceCarrier);
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].memberId.key, PATIENT_INSURANCE_MEMBER_ID);
      await primaryInsuranceCard.clickShowMoreButton();
      await primaryInsuranceCard.verifyAdditionalFieldsAreVisible();
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].firstName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].lastName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].middleName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME
      );
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].birthDate.key, POLICY_HOLDER_DATE_OF_BIRTH);
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].birthSex.key,
        PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].streetAddress.key,
        PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].addressLine2.key,
        PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].city.key,
        PATIENT_INSURANCE_POLICY_HOLDER_CITY
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].state.key,
        PATIENT_INSURANCE_POLICY_HOLDER_STATE
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].zip.key,
        PATIENT_INSURANCE_POLICY_HOLDER_ZIP
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].relationship.key,
        PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
      );
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].additionalInformation.key, '');
      await primaryInsuranceCard.clickShowMoreButton();
      await primaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();

      const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyInsuranceType('Secondary');
      await secondaryInsuranceCard.verifyInsuranceCarrier(secondaryInsuranceCarrier);
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].memberId.key,
        PATIENT_INSURANCE_MEMBER_ID_2
      );
      await secondaryInsuranceCard.clickShowMoreButton();
      await secondaryInsuranceCard.verifyAdditionalFieldsAreVisible();
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].firstName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].lastName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].middleName.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].birthDate.key,
        POLICY_HOLDER_2_DATE_OF_BIRTH
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].birthSex.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].streetAddress.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].addressLine2.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].city.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_CITY
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].state.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_STATE
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].zip.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].relationship.key,
        PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
      );
      await secondaryInsuranceCard.verifyTextField(insuranceSection.items[1].additionalInformation.key, '');
      await secondaryInsuranceCard.clickShowMoreButton();
      await secondaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
    }
  );

  test('Check validation error is displayed if any required field in Insurance information block is missing', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.clearField(insuranceSection.items[0].memberId.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].firstName.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].lastName.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].birthDate.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].streetAddress.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].city.key);
    await primaryInsuranceCard.clearField(insuranceSection.items[0].zip.key);
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].memberId.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].firstName.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].lastName.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].birthDate.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].streetAddress.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].city.key);
    await secondaryInsuranceCard.clearField(insuranceSection.items[1].zip.key);
    await patientInformationPage.clickSaveChangesButton();

    // Primary insurance validation errors - using config keys
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].memberId.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].firstName.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].lastName.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].birthDate.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].streetAddress.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].city.key);
    await primaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[0].zip.key);

    // Secondary insurance validation errors - using config keys
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].memberId.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].firstName.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].lastName.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].birthDate.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].streetAddress.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].city.key);
    await secondaryInsuranceCard.verifyValidationErrorShown(insuranceSection.items[1].zip.key);
  });
});

test.describe('Insurance Information Section mutating tests', () => {
  let resourceHandler: ResourceHandler;

  test.beforeAll(async () => {
    const [createdResourceHandler, _createdPrimaryInsuranceCarrier, _createdSecondaryInsuranceCarrier] =
      await createResourceHandler();
    resourceHandler = createdResourceHandler;
  });

  test.beforeEach(async () => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Enter invalid zip on Insurance information block, validation error are shown', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.enterTextField(insuranceSection.items[0].zip.key, '11');
    await patientInformationPage.clickSaveChangesButton();
    await primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
    await primaryInsuranceCard.enterTextField(insuranceSection.items[0].zip.key, '11223344');
    await patientInformationPage.clickSaveChangesButton();
    await primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();

    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.enterTextField(insuranceSection.items[1].zip.key, '11');
    await patientInformationPage.clickSaveChangesButton();
    await secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
    await secondaryInsuranceCard.enterTextField(insuranceSection.items[1].zip.key, '11223344');
    await patientInformationPage.clickSaveChangesButton();
    await secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
  });

  test('Updated values from Insurance information block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER);
    await primaryInsuranceCard.selectFieldOption(
      insuranceSection.items[0].insurancePlanType.key,
      NEW_PATIENT_INSURANCE_PLAN_TYPE
    );
    await primaryInsuranceCard.enterTextField(insuranceSection.items[0].memberId.key, NEW_PATIENT_INSURANCE_MEMBER_ID);
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].firstName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].middleName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].lastName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME
    );
    await primaryInsuranceCard.enterDateField(
      insuranceSection.items[0].birthDate.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH
    );
    await primaryInsuranceCard.selectFieldOption(
      insuranceSection.items[0].birthSex.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].streetAddress.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].addressLine2.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].city.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY
    );
    await primaryInsuranceCard.selectFieldOption(
      insuranceSection.items[0].state.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].zip.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP
    );
    await primaryInsuranceCard.selectFieldOption(
      insuranceSection.items[0].relationship.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
    );
    await primaryInsuranceCard.enterTextField(
      insuranceSection.items[0].additionalInformation.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO
    );

    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2);
    await secondaryInsuranceCard.selectFieldOption(
      insuranceSection.items[1].insurancePlanType.key,
      NEW_PATIENT_INSURANCE_PLAN_TYPE_2
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].memberId.key,
      NEW_PATIENT_INSURANCE_MEMBER_ID_2
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].firstName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].middleName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].lastName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME
    );
    await secondaryInsuranceCard.enterDateField(
      insuranceSection.items[1].birthDate.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH
    );
    await secondaryInsuranceCard.selectFieldOption(
      insuranceSection.items[1].birthSex.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].streetAddress.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].addressLine2.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].city.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY
    );
    await secondaryInsuranceCard.selectFieldOption(
      insuranceSection.items[1].state.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].zip.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP
    );
    await secondaryInsuranceCard.selectFieldOption(
      insuranceSection.items[1].relationship.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
    );
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].additionalInformation.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2
    );

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    await openPatientInformationPage(page, resourceHandler.patient.id!);
    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER);
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].insurancePlanType.key,
      NEW_PATIENT_INSURANCE_PLAN_TYPE
    );
    await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].memberId.key, NEW_PATIENT_INSURANCE_MEMBER_ID);
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].firstName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].middleName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].lastName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].birthDate.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].birthSex.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].streetAddress.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].addressLine2.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].city.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].state.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].zip.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].relationship.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
    );
    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].additionalInformation.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO
    );

    await secondaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2);
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].insurancePlanType.key,
      NEW_PATIENT_INSURANCE_PLAN_TYPE_2
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].memberId.key,
      NEW_PATIENT_INSURANCE_MEMBER_ID_2
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].firstName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].middleName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].lastName.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].birthDate.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].birthSex.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].streetAddress.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].addressLine2.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].city.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].state.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].zip.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].relationship.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].additionalInformation.key,
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2
    );
  });

  test('Set and remove Additional Insurance Information for both primary and secondary insurance, then verify it is cleared after save', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);

    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await primaryInsuranceCard.selectFieldOption(
      insuranceSection.items[0].insurancePlanType.key,
      PATIENT_INSURANCE_PLAN_TYPE
    );
    await secondaryInsuranceCard.selectFieldOption(
      insuranceSection.items[1].insurancePlanType.key,
      PATIENT_INSURANCE_PLAN_TYPE_2
    );

    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.enterTextField(insuranceSection.items[0].additionalInformation.key, 'Primary test info');
    await secondaryInsuranceCard.enterTextField(
      insuranceSection.items[1].additionalInformation.key,
      'Secondary test info'
    );

    await primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();
    await secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();

    await patientInformationPage.reloadPatientInformationPage();
    await primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();
    await secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();

    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyTextField(
      insuranceSection.items[0].additionalInformation.key,
      'Primary test info'
    );
    await secondaryInsuranceCard.verifyTextField(
      insuranceSection.items[1].additionalInformation.key,
      'Secondary test info'
    );

    await primaryInsuranceCard.enterTextField(insuranceSection.items[0].additionalInformation.key, '');
    await secondaryInsuranceCard.enterTextField(insuranceSection.items[1].additionalInformation.key, '');

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();

    await patientInformationPage.reloadPatientInformationPage();
    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].additionalInformation.key, '');
    await secondaryInsuranceCard.verifyTextField(insuranceSection.items[1].additionalInformation.key, '');
  });

  test('Check [Add insurance] button is hidden when both primary and secondary insurances are present,[Add insurance] button is present if primary insurance is removed and "Type" on "Add insurance" screen is pre-filled with "Primary"', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyAddInsuranceButtonIsHidden();
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.clickRemoveInsuranceButton();
    await patientInformationPage.verifyCoverageRemovedMessageShown();
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.verifyTypeField('Primary', false);
  });

  test('Check [Add insurance] button is present if Primary insurance is removed and "Type" on "Add insurance" screen is pre-filled with "Secondary"', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickRemoveInsuranceButton();
    await patientInformationPage.verifyCoverageRemovedMessageShown();
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.verifyTypeField('Secondary', false);
  });
});

async function createResourceHandler(): Promise<[ResourceHandler, string, string]> {
  let insuranceCarrier1: QuestionnaireItemAnswerOption | undefined = undefined;
  let insuranceCarrier2: QuestionnaireItemAnswerOption | undefined = undefined;
  const PROCESS_ID = `patientRecordInsuranceSection-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person', async ({ patientInfo }) => {
    const answers = [];
    answers.push(
      getContactInformationAnswers({
        firstName: patientInfo.firstName,
        lastName: patientInfo.lastName,
        birthDate: isoToDateObject(patientInfo.dateOfBirth || '') || undefined,
        email: patientInfo.email,
        phoneNumber: patientInfo.phoneNumber,
        birthSex: patientInfo.sex,
      }),
      getPatientDetailsStepAnswers({}),
      getPaymentOptionInsuranceAnswers({
        insuranceCarrier: insuranceCarrier1!,
        insurancePlanType: PATIENT_INSURANCE_PLAN_TYPE,
        insuranceMemberId: PATIENT_INSURANCE_MEMBER_ID,
        insurancePolicyHolderFirstName: PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME,
        insurancePolicyHolderLastName: PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME,
        insurancePolicyHolderMiddleName: PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME,
        insurancePolicyHolderDateOfBirth: PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH,
        insurancePolicyHolderBirthSex: PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX,
        insurancePolicyHolderAddressAsPatient: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT,
        insurancePolicyHolderAddress: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS,
        insurancePolicyHolderAddressAdditionalLine: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE,
        insurancePolicyHolderCity: PATIENT_INSURANCE_POLICY_HOLDER_CITY,
        insurancePolicyHolderState: PATIENT_INSURANCE_POLICY_HOLDER_STATE,
        insurancePolicyHolderZip: PATIENT_INSURANCE_POLICY_HOLDER_ZIP,
        insurancePolicyHolderRelationshipToInsured: PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED,
        insuranceCarrier2: insuranceCarrier2!,
        insurancePlanType2: PATIENT_INSURANCE_PLAN_TYPE_2,
        insuranceMemberId2: PATIENT_INSURANCE_MEMBER_ID_2,
        insurancePolicyHolderFirstName2: PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME,
        insurancePolicyHolderLastName2: PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME,
        insurancePolicyHolderMiddleName2: PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME,
        insurancePolicyHolderDateOfBirth2: PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH,
        insurancePolicyHolderBirthSex2: PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX,
        insurancePolicyHolderAddressAsPatient2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT,
        insurancePolicyHolderAddress2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS,
        insurancePolicyHolderAddressAdditionalLine2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE,
        insurancePolicyHolderCity2: PATIENT_INSURANCE_POLICY_HOLDER_2_CITY,
        insurancePolicyHolderState2: PATIENT_INSURANCE_POLICY_HOLDER_2_STATE,
        insurancePolicyHolderZip2: PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP,
        insurancePolicyHolderRelationshipToInsured2: PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED,
      }),
      getResponsiblePartyStepAnswers({}),
      getEmergencyContactStepAnswers({}),
      getPrimaryCarePhysicianStepAnswers({})
    );
    if (hasEmployerInformationPage()) {
      answers.push(getEmployerInformationStepAnswers({}));
    }
    if (hasAttorneyInformationPage()) {
      answers.push(getAttorneyInformationStepAnswers({}));
    }
    answers.push(getConsentStepAnswers({}));
    return answers;
  });
  const oystehr = await ResourceHandler.getOystehr();
  const insuranceCarriersOptions = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'active',
          value: 'true',
        },
        {
          name: 'type',
          value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
        },
      ],
    })
  ).unbundle();
  const ic1 = insuranceCarriersOptions.at(0);
  const ic2 = insuranceCarriersOptions.at(1);
  insuranceCarrier1 = {
    valueReference: {
      reference: ic1 && createReference(ic1).reference,
      display: ic1?.name,
    },
  };
  insuranceCarrier2 = {
    valueReference: {
      reference: ic2 && createReference(ic2).reference,
      display: ic2?.name,
    },
  };
  const insuranceCarrier1ForResult = `${getPayerId(ic1)} - ${ic1?.name}`;
  const insuranceCarrier2ForResult = `${getPayerId(ic2)} - ${ic2?.name}`;
  console.log('carrier: ', JSON.stringify(insuranceCarrier1ForResult));

  await resourceHandler.setResources();
  await Promise.all([
    resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!),
    resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!),
  ]);
  return [resourceHandler, insuranceCarrier1ForResult ?? '', insuranceCarrier2ForResult ?? ''];
}
