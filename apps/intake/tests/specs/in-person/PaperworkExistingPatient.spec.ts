// cSpell:ignore IPPP
import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Locators } from '../../utils/locators';
import { Paperwork, PATIENT_ADDRESS, PATIENT_ADDRESS_LINE_2, PATIENT_CITY, PATIENT_ZIP } from '../../utils/Paperwork';
import { InPersonRpInsNoReqPatient } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let locator: Locators;
let patient: InPersonRpInsNoReqPatient;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  locator = new Locators(page);

  const testDataPath = path.join('test-data', 'inPersonRpInsNoReqPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('In-Person - Prefilled Paperwork, Responsible Party: not self, Payment: Insurance', () => {
  test('IPPP-1. Contact information', async () => {
    await test.step('IPPP-1.1. Open Contact information page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/contact-information`);
      await paperwork.checkCorrectPageOpens('Contact information');
    });

    await test.step('IPPP-1.2. Check all fields have prefilled values', async () => {
      await expect(locator.patientState).toHaveValue(patient.state);
      await expect(locator.patientZip).toHaveValue(PATIENT_ZIP);
      await expect(locator.patientCity).toHaveValue(PATIENT_CITY);
      await expect(locator.streetAddress).toHaveValue(PATIENT_ADDRESS);
      await expect(locator.streetAddressLine2).toHaveValue(PATIENT_ADDRESS_LINE_2);
      await paperwork.checkEmailIsPrefilled(patient.email);
      await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
      await expect(locator.mobileOptIn).toBeChecked();
    });
  });

  test('IPPP-2. Patient details', async () => {
    await test.step('IPPP-2.1. Open Patient details page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/patient-details`);
      await paperwork.checkCorrectPageOpens('Patient details');
    });

    await test.step('IPPP-2.2. Check all fields have prefilled values', async () => {
      await expect(locator.patientEthnicity).toHaveValue(patient.patientDetailsData.randomEthnicity);
      await expect(locator.patientRace).toHaveValue(patient.patientDetailsData.randomRace);
      await expect(locator.patientPronouns).toHaveValue(patient.patientDetailsData.randomPronoun);
      await expect(locator.patientPointOfDiscovery).toBeHidden();
      await expect(locator.patientPreferredLanguage).toHaveValue(patient.patientDetailsData.randomLanguage);
    });
  });

  test('IPPP-3. Primary Care Physician', async () => {
    await test.step('IPPP-3.1. Open Primary Care Physician page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/primary-care-physician`);
      await paperwork.checkCorrectPageOpens('Primary Care Physician');
    });

    await test.step('IPPP-3.2. Check all fields have prefilled values', async () => {
      await expect(locator.pcpFirstName).toHaveValue(patient.pcpData.firstName);
      await expect(locator.pcpLastName).toHaveValue(patient.pcpData.lastName);
      await expect(locator.pcpAddress).toHaveValue(patient.pcpData.pcpAddress);
      await expect(locator.pcpNumber).toHaveValue(patient.pcpData.formattedPhoneNumber);
      await expect(locator.pcpPractice).toHaveValue(patient.pcpData.pcpName);
    });
  });

  test('IPPP-4. Primary insurance', async () => {
    await test.step('IPPP-4.1. Open Payment option page directly, check insurance is preselected', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      await expect(locator.insuranceHeading).toBeVisible();
    });

    await test.step('IPPP-4.2. Check cards are prefilled', async () => {
      await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
      await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
    });

    await test.step('IPPP-4.3. Check data is prefilled', async () => {
      await expect(locator.insuranceCarrier).toHaveValue(patient.insuranceData!.insuranceRequiredData.insuranceCarrier);
      await expect(locator.insuranceMemberID).toHaveValue(patient.insuranceData!.insuranceRequiredData.insuranceMember);
      await expect(locator.policyHolderDOB).toHaveValue(patient.insuranceData!.insuranceRequiredData.paperworkDOB);
      await expect(locator.policyHolderFirstName).toHaveValue(patient.insuranceData!.insuranceRequiredData.firstName);
      await expect(locator.policyHolderLastName).toHaveValue(patient.insuranceData!.insuranceRequiredData.lastName);
      await expect(locator.policyHolderMiddleName).toHaveValue(
        patient.insuranceData!.insuranceOptionalData.policyHolderMiddleName
      );
      await expect(locator.patientRelationship).toHaveValue(patient.insuranceData!.insuranceRequiredData.relationship);
      await expect(locator.policyHolderBirthSex).toHaveValue(patient.insuranceData!.insuranceRequiredData.birthSex);
      await expect(locator.policyHolderAddress).toHaveValue(
        patient.insuranceData!.insuranceRequiredData.policyHolderAddress
      );
      await expect(locator.policyHolderCity).toHaveValue(patient.insuranceData!.insuranceRequiredData.policyHolderCity);
      await expect(locator.policyHolderState).toHaveValue(
        patient.insuranceData!.insuranceRequiredData.policyHolderState
      );
      await expect(locator.policyHolderZip).toHaveValue(patient.insuranceData!.insuranceRequiredData.policyHolderZip);
      await expect(locator.policyHolderAddressLine2).toHaveValue(
        patient.insuranceData!.insuranceOptionalData.policyHolderAddressLine2
      );
    });
  });

  test('IPPP-5. Secondary insurance', async () => {
    await test.step('IPPP-5.1. Open Payment option page directly, check secondary insurance is preselected', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      await expect(locator.secondaryInsuranceHeading).toBeVisible();
    });

    await test.step('IPPP-5.2. Check cards are prefilled', async () => {
      await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
      await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
    });

    await test.step('IPPP-5.3. Check data is prefilled', async () => {
      await expect(locator.secondaryInsuranceCarrier).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.insuranceCarrier
      );
      await expect(locator.secondaryInsuranceMemberID).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.insuranceMember
      );
      await expect(locator.secondaryPolicyHolderDOB).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.paperworkDOB
      );
      await expect(locator.secondaryPolicyHolderFirstName).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.firstName
      );
      await expect(locator.secondaryPolicyHolderLastName).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.lastName
      );
      await expect(locator.secondaryPolicyHolderMiddleName).toHaveValue(
        patient.secondaryInsuranceData!.insuranceOptionalData.policyHolderMiddleName
      );
      await expect(locator.secondaryPatientRelationship).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.relationship
      );
      await expect(locator.secondaryPolicyHolderBirthSex).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.birthSex
      );
      await expect(locator.secondaryPolicyHolderAddress).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.policyHolderAddress
      );
      await expect(locator.secondaryPolicyHolderCity).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.policyHolderCity
      );
      await expect(locator.secondaryPolicyHolderState).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.policyHolderState
      );
      await expect(locator.secondaryPolicyHolderZip).toHaveValue(
        patient.secondaryInsuranceData!.insuranceRequiredData.policyHolderZip
      );
      await expect(locator.secondaryPolicyHolderAddressLine2).toHaveValue(
        patient.secondaryInsuranceData!.insuranceOptionalData.policyHolderAddressLine2
      );
    });
  });

  test('IPPP-6. Responsible party', async () => {
    await test.step('IPPP-6.1. Open Responsible party page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/responsible-party`);
      await paperwork.checkCorrectPageOpens('Responsible party information');
    });

    await test.step('IPPP-6.2. Check all fields have prefilled values', async () => {
      await expect(locator.responsiblePartyFirstName).toHaveValue(patient.responsiblePartyData!.firstName);
      await expect(locator.responsiblePartyLastName).toHaveValue(patient.responsiblePartyData!.lastName);
      await expect(locator.responsiblePartyBirthSex).toHaveValue(patient.responsiblePartyData!.birthSex);
      await expect(locator.responsiblePartyRelationship).toHaveValue(patient.responsiblePartyData!.relationship);
      await expect(locator.responsiblePartyDOBAnswer).toHaveValue(patient.responsiblePartyData!.dob);
      await expect(locator.responsiblePartyCity).toHaveValue(patient.responsiblePartyData!.city);
      await expect(locator.responsiblePartyState).toHaveValue(patient.responsiblePartyData!.state);
      await expect(locator.responsiblePartyZip).toHaveValue(patient.responsiblePartyData!.zip);
      await expect(locator.responsiblePartyAddress1).toHaveValue(patient.responsiblePartyData!.address1);
      await expect(locator.responsiblePartyAddress2).toHaveValue(patient.responsiblePartyData!.additionalAddress);
      await expect(locator.responsiblePartyNumber).toHaveValue(patient.responsiblePartyData!.phone);
      await expect(locator.responsiblePartyEmail).toHaveValue(patient.responsiblePartyData!.email);
    });
  });

  test('IPPP-7. Photo ID', async () => {
    await test.step('IPPP-7.1. Open photo ID page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/photo-id`);
      await paperwork.checkCorrectPageOpens('Photo ID');
    });

    await test.step('IPPP-7.2. Check all fields have prefilled values', async () => {
      await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
      await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
    });
  });

  test('IPPP-8. Consent forms', async () => {
    await test.step('IPPP-8.1. Open consent forms page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/consent-forms`);
      await paperwork.checkCorrectPageOpens('Complete consent forms');
    });

    await test.step("IPPP-8.2. Check all fields don't have prefilled values", async () => {
      await expect(locator.hipaaAcknowledgement).not.toBeChecked();
      await expect(locator.consentToTreat).not.toBeChecked();
      await expect(locator.signature).toHaveValue('');
      await expect(locator.consentFullName).toHaveValue('');
      await expect(locator.consentSignerRelationship).toHaveValue('');
    });
  });
});
