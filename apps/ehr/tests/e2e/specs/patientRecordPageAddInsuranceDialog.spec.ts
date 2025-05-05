import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

import { openPatientInformationPage } from '../page/PatientInformationPage';

import { dataTestIds } from '../../../src/constants/data-test-ids';

const INSURANCE_MEMBER_ID = 'abc1234567';
const INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
const INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
const INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
const INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
const INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannock';
const INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
const INSURANCE_POLICY_HOLDER_STATE = 'AK';
const INSURANCE_POLICY_HOLDER_ZIP = '78956';
//const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
const INSURANCE_CARRIER = '6 Degrees Health Incorporated';

const INSURANCE_MEMBER_ID_2 = '987548ert';
const INSURANCE_POLICY_HOLDER_ADDRESS_2 = 'second street';
const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2 = 'additional2';
const INSURANCE_POLICY_HOLDER_BIRTH_SEX_2 = 'Male';
const INSURANCE_POLICY_HOLDER_CITY_2 = 'Denver';
const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2 = '03/03/1991';
const INSURANCE_POLICY_HOLDER_FIRST_NAME_2 = 'David';
const INSURANCE_POLICY_HOLDER_LAST_NAME_2 = 'Corbett';
const INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2 = 'Roger';
const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2 = 'Injured Party';
const INSURANCE_POLICY_HOLDER_STATE_2 = 'CO';
const INSURANCE_POLICY_HOLDER_ZIP_2 = '21211';
//const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2  = 'testing2';
const INSURANCE_CARRIER_2 = 'ACTIN Care Groups';

test.describe('Insurance Information Section non-mutating tests', () => {
  const resourceHandler = new ResourceHandler();

  test.beforeAll(async () => {
    await resourceHandler.setResources();
    await Promise.all([
      resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!),
      resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!),
    ]);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

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
});

test.describe('Insurance Information Section mutating tests', () => {
  const resourceHandler = new ResourceHandler();

  test.beforeEach(async () => {
    await resourceHandler.setResources();
    await Promise.all([
      resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!),
      resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!),
    ]);
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Fill fields and add primary and secondary insurances, verify insurances are saved successfully with correct data', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    const addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.selectInsuranceType('Primary');
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
    //await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
    await primaryInsuranceCard.clickShowMoreButton();
    await primaryInsuranceCard.verifyInsuranceType('Primary');
    await primaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER);
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
    //await primaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);

    await patientInformationPage.clickAddInsuranceButton();
    await addInsuranceDialog.verifyTypeField('Secondary', false);
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
    //await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2);
    await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

    await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
    await patientInformationPage.reloadPatientInformationPage();
    const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
    await secondaryInsuranceCard.clickShowMoreButton();
    await secondaryInsuranceCard.verifyInsuranceType('Secondary');
    await secondaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER_2);
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
    //await secondaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2);
  });
});
