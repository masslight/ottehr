import { test } from '@playwright/test';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  chooseJson,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionInsuranceAnswers,
  getPrimaryCarePhysicianStepAnswers,
  getResponsiblePartyStepAnswers,
  INSURANCE_PLAN_PAYER_META_TAG_CODE,
  isoToDateObject,
} from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import {
  PATIENT_INSURANCE_MEMBER_ID,
  PATIENT_INSURANCE_MEMBER_ID_2,
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
const NEW_PATIENT_INSURANCE_CARRIER = '6 Degrees Health Incorporated';
const NEW_PATIENT_INSURANCE_CARRIER_2 = 'AAA - Minnesota/Iowa';

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

  test.skip(
    'Verify data from Primary and Secondary Insurances blocks are displayed correctly',
    { tag: '@flaky' },
    async ({ page }) => {
      const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
      const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await primaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await primaryInsuranceCard.verifyInsuranceType('Primary');
      await primaryInsuranceCard.verifyInsuranceCarrier(primaryInsuranceCarrier);
      await primaryInsuranceCard.verifyMemberId(PATIENT_INSURANCE_MEMBER_ID);
      await primaryInsuranceCard.clickShowMoreButton();
      await primaryInsuranceCard.verifyAdditionalFieldsAreVisible();
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await primaryInsuranceCard.verifyPolicyHoldersFirstName(PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME);
      await primaryInsuranceCard.verifyPolicyHoldersLastName(PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME);
      await primaryInsuranceCard.verifyPolicyHoldersMiddleName(PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
      await primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(POLICY_HOLDER_DATE_OF_BIRTH);
      await primaryInsuranceCard.verifyPolicyHoldersSex(PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX);
      await primaryInsuranceCard.verifyInsuranceStreetAddress(PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS);
      await primaryInsuranceCard.verifyInsuranceAddressLine2(PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE);
      await primaryInsuranceCard.verifyInsuranceCity(PATIENT_INSURANCE_POLICY_HOLDER_CITY);
      await primaryInsuranceCard.verifyInsuranceState(PATIENT_INSURANCE_POLICY_HOLDER_STATE);
      await primaryInsuranceCard.verifyInsuranceZip(PATIENT_INSURANCE_POLICY_HOLDER_ZIP);
      await primaryInsuranceCard.verifyPatientsRelationshipToInjured(
        PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
      );
      await primaryInsuranceCard.verifyAdditionalInsuranceInformation('');
      await primaryInsuranceCard.clickShowMoreButton();
      await primaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();

      const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyAdditionalFieldsAreHidden();
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyInsuranceType('Secondary');
      await secondaryInsuranceCard.verifyInsuranceCarrier(secondaryInsuranceCarrier);
      await secondaryInsuranceCard.verifyMemberId(PATIENT_INSURANCE_MEMBER_ID_2);
      await secondaryInsuranceCard.clickShowMoreButton();
      await secondaryInsuranceCard.verifyAdditionalFieldsAreVisible();
      await secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible();
      await secondaryInsuranceCard.verifyPolicyHoldersFirstName(PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME);
      await secondaryInsuranceCard.verifyPolicyHoldersLastName(PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME);
      await secondaryInsuranceCard.verifyPolicyHoldersMiddleName(PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME);
      await secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(POLICY_HOLDER_2_DATE_OF_BIRTH);
      await secondaryInsuranceCard.verifyPolicyHoldersSex(PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX);
      await secondaryInsuranceCard.verifyInsuranceStreetAddress(PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS);
      await secondaryInsuranceCard.verifyInsuranceAddressLine2(
        PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
      );
      await secondaryInsuranceCard.verifyInsuranceCity(PATIENT_INSURANCE_POLICY_HOLDER_2_CITY);
      await secondaryInsuranceCard.verifyInsuranceState(PATIENT_INSURANCE_POLICY_HOLDER_2_STATE);
      await secondaryInsuranceCard.verifyInsuranceZip(PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP);
      await secondaryInsuranceCard.verifyPatientsRelationshipToInjured(
        PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
      );
      await secondaryInsuranceCard.verifyAdditionalInsuranceInformation('');
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
    await primaryInsuranceCard.clearMemberIdField();
    await primaryInsuranceCard.clearPolicyHolderFirstNameField();
    await primaryInsuranceCard.clearPolicyHolderLastNameField();
    await primaryInsuranceCard.clearDateOfBirthFromInsuranceContainer();
    await primaryInsuranceCard.clearStreetAddressFromInsuranceContainer();
    await primaryInsuranceCard.clearCityFromInsuranceContainer();
    await primaryInsuranceCard.clearZipFromInsuranceContainer();
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clearMemberIdField();
    await secondaryInsuranceCard.clearPolicyHolderFirstNameField();
    await secondaryInsuranceCard.clearPolicyHolderLastNameField();
    await secondaryInsuranceCard.clearDateOfBirthFromInsuranceContainer();
    await secondaryInsuranceCard.clearStreetAddressFromInsuranceContainer();
    await secondaryInsuranceCard.clearCityFromInsuranceContainer();
    await secondaryInsuranceCard.clearZipFromInsuranceContainer();
    await patientInformationPage.clickSaveChangesButton();

    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.memberId);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersFirstName);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersLastName);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersDateOfBirth);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.streetAddress);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.city);
    await primaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.zip);

    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.memberId);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersFirstName);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersLastName);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.policyHoldersDateOfBirth);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.streetAddress);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.city);
    await secondaryInsuranceCard.verifyValidationErrorShown(dataTestIds.insuranceContainer.zip);
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
    await primaryInsuranceCard.enterZipFromInsuranceContainer('11');
    await patientInformationPage.clickSaveChangesButton();
    await primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
    await primaryInsuranceCard.enterZipFromInsuranceContainer('11223344');
    await patientInformationPage.clickSaveChangesButton();
    await primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();

    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.enterZipFromInsuranceContainer('11');
    await patientInformationPage.clickSaveChangesButton();
    await secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
    await secondaryInsuranceCard.enterZipFromInsuranceContainer('11223344');
    await patientInformationPage.clickSaveChangesButton();
    await secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance();
  });

  test('Updated values from Insurance information block are saved and displayed correctly', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER);
    await primaryInsuranceCard.enterMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID);
    await primaryInsuranceCard.enterPolicyHolderFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME);
    await primaryInsuranceCard.enterPolicyHolderMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
    await primaryInsuranceCard.enterPolicyHolderLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME);
    await primaryInsuranceCard.enterDateOfBirthFromInsuranceContainer(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH
    );
    await primaryInsuranceCard.selectPolicyHoldersBirthSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX);
    await primaryInsuranceCard.enterPolicyHolderStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS);
    await primaryInsuranceCard.enterPolicyHolderAddressLine2(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE
    );
    await primaryInsuranceCard.enterPolicyHolderCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY);
    await primaryInsuranceCard.selectPolicyHoldersState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE);
    await primaryInsuranceCard.enterZipFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP);
    await primaryInsuranceCard.selectPatientsRelationship(NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
    await primaryInsuranceCard.enterAdditionalInsuranceInformation(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);

    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2);
    await secondaryInsuranceCard.enterMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID_2);
    await secondaryInsuranceCard.enterPolicyHolderFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME);
    await secondaryInsuranceCard.enterPolicyHolderMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME);
    await secondaryInsuranceCard.enterPolicyHolderLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME);
    await secondaryInsuranceCard.enterDateOfBirthFromInsuranceContainer(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH
    );
    await secondaryInsuranceCard.selectPolicyHoldersBirthSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX);
    await secondaryInsuranceCard.enterPolicyHolderStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS);
    await secondaryInsuranceCard.enterPolicyHolderAddressLine2(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
    );
    await secondaryInsuranceCard.enterPolicyHolderCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY);
    await secondaryInsuranceCard.selectPolicyHoldersState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE);
    await secondaryInsuranceCard.enterZipFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP);
    await secondaryInsuranceCard.selectPatientsRelationship(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
    );
    await secondaryInsuranceCard.enterAdditionalInsuranceInformation(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2
    );

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    await openPatientInformationPage(page, resourceHandler.patient.id!);
    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER);
    await primaryInsuranceCard.verifyMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID);
    await primaryInsuranceCard.verifyPolicyHoldersFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME);
    await primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
    await primaryInsuranceCard.verifyPolicyHoldersSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX);
    await primaryInsuranceCard.verifyInsuranceStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS);
    await primaryInsuranceCard.verifyInsuranceAddressLine2(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE);
    await primaryInsuranceCard.verifyInsuranceCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY);
    await primaryInsuranceCard.verifyInsuranceState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE);
    await primaryInsuranceCard.verifyInsuranceZip(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP);
    await primaryInsuranceCard.verifyPatientsRelationshipToInjured(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
    );
    await primaryInsuranceCard.verifyAdditionalInsuranceInformation(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO
    );

    await secondaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2);
    await secondaryInsuranceCard.verifyMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID_2);
    await secondaryInsuranceCard.verifyPolicyHoldersFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME);
    await secondaryInsuranceCard.verifyPolicyHoldersMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME);
    await secondaryInsuranceCard.verifyPolicyHoldersLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME);
    await secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH);
    await secondaryInsuranceCard.verifyPolicyHoldersSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX);
    await secondaryInsuranceCard.verifyInsuranceStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS);
    await secondaryInsuranceCard.verifyInsuranceAddressLine2(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE
    );
    await secondaryInsuranceCard.verifyInsuranceCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY);
    await secondaryInsuranceCard.verifyInsuranceState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE);
    await secondaryInsuranceCard.verifyInsuranceZip(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP);
    await secondaryInsuranceCard.verifyPatientsRelationshipToInjured(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED
    );
    await secondaryInsuranceCard.verifyAdditionalInsuranceInformation(
      NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2
    );
  });

  test('Set and remove Additional Insurance Information for both primary and secondary insurance, then verify it is cleared after save', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);

    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);

    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.enterAdditionalInsuranceInformation('Primary test info');
    await secondaryInsuranceCard.enterAdditionalInsuranceInformation('Secondary test info');

    await primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();
    await secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();

    await patientInformationPage.reloadPatientInformationPage();
    await primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();
    await secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered();

    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyAdditionalInsuranceInformation('Primary test info');
    await secondaryInsuranceCard.verifyAdditionalInsuranceInformation('Secondary test info');

    await primaryInsuranceCard.enterAdditionalInsuranceInformation('');
    await secondaryInsuranceCard.enterAdditionalInsuranceInformation('');

    await patientInformationPage.clickSaveChangesButton();
    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();

    await patientInformationPage.reloadPatientInformationPage();
    await primaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.clickShowMoreButton();

    await primaryInsuranceCard.verifyAdditionalInsuranceInformation('');
    await secondaryInsuranceCard.verifyAdditionalInsuranceInformation('');
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
    return [
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
      getConsentStepAnswers({}),
      getPrimaryCarePhysicianStepAnswers({}),
    ];
  });
  const oystehr = await ResourceHandler.getOystehr();
  const insuranceCarriersOptionsResponse = await oystehr.zambda.execute({
    id: process.env.GET_ANSWER_OPTIONS_ZAMBDA_ID!,
    answerSource: {
      resourceType: 'InsurancePlan',
      query: `status=active&_tag=${INSURANCE_PLAN_PAYER_META_TAG_CODE}`,
    },
  });
  const insuranceCarriersOptions = chooseJson(insuranceCarriersOptionsResponse) as QuestionnaireItemAnswerOption[];
  insuranceCarrier1 = insuranceCarriersOptions.at(0);
  insuranceCarrier2 = insuranceCarriersOptions.at(1);
  await resourceHandler.setResources();
  await Promise.all([
    resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!),
    resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!),
  ]);
  return [
    resourceHandler,
    insuranceCarrier1?.valueReference?.display ?? '',
    insuranceCarrier2?.valueReference?.display ?? '',
  ];
}
