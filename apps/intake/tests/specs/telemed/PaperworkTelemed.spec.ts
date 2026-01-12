// cSpell:ignore networkidle, PPCP, PRPI, PSWN
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { BOOKING_CONFIG } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { QuestionnaireHelper } from '../../utils/QuestionnaireHelper';
import { PaperworkTelemed } from '../../utils/telemed/Paperwork';
import { UploadDocs } from '../../utils/UploadDocs';
import { TelemedNoPwPatient } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let paperworkTelemed: PaperworkTelemed;
let locator: Locators;
let uploadDocs: UploadDocs;
let commonLocatorsHelper: CommonLocatorsHelper;
let patient: TelemedNoPwPatient;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  paperworkTelemed = new PaperworkTelemed(page);
  locator = new Locators(page);
  uploadDocs = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);

  const testDataPath = path.join('test-data', 'telemedNoPwPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('Telemed - No Paperwork Filled Yet', () => {
  test('PCI. Contact information', async () => {
    await test.step('PCI-1. Open Contact information page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/contact-information`);
      await paperwork.checkCorrectPageOpens('Contact information');
    });

    await test.step('PCI-2. Fill all fields', async () => {
      await paperwork.fillContactInformationAllFields();
    });

    await test.step('PCI-3. Check email is prefilled', async () => {
      await paperwork.checkEmailIsPrefilled(patient.email);
    });

    await test.step('PCI-4. Check mobile is prefilled', async () => {
      await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
    });

    await test.step('PCI-5. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PCI-6. Click on [Continue] - Patient details screen opens', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Patient details');
    });
  });

  test('PPD. Patient details', async () => {
    await test.step('PPD-1. Open Patient details page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/patient-details`);
      await paperwork.checkCorrectPageOpens('Patient details');
    });

    await test.step('PPD-2. Check required fields', async () => {
      await paperwork.checkRequiredFields(
        '"Ethnicity","Race","Preferred language","Do you require a Hearing Impaired Relay Service? (711)"',
        'Patient details',
        true
      );
    });

    await test.step('PPD-3. Fill all fields', async () => {
      await paperwork.fillPatientDetailsAllFields(true);
    });

    await test.step('PPD-4. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PPD-5. Fill not listed pronoun', async () => {
      await paperwork.fillNotListedPronouns();
    });

    await test.step('PPD-6. Click on [Continue] - Primary Care Physician screen opens', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Primary Care Physician');
    });
  });

  test('PPCP. Primary Care Physician', async () => {
    await test.step('PPCP-1. Open Primary Care Physician page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/primary-care-physician`);
      await paperwork.checkCorrectPageOpens('Primary Care Physician');
    });

    await test.step('PPCP-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PPCP-3. Check phone field validation', async () => {
      await paperwork.checkPhoneValidations(locator.pcpNumber);
    });

    await test.step('PPCP-4. Click on [Continue] with empty fields - Preferred pharmacy opens', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Preferred pharmacy');
    });

    const pcpData =
      await test.step('PPCP-5. Fill all fields and click [Continue] - Preferred pharmacy opens', async () => {
        await locator.clickBackButton();
        const pcpData = await paperwork.fillPrimaryCarePhysician();
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Preferred pharmacy');
        return pcpData;
      });

    await test.step('PPCP-6. Click on [Back] - fields have correct values', async () => {
      await locator.clickBackButton();
      await expect(locator.pcpFirstName).toHaveValue(pcpData.firstName);
      await expect(locator.pcpLastName).toHaveValue(pcpData.lastName);
      await expect(locator.pcpAddress).toHaveValue(pcpData.pcpAddress);
      await expect(locator.pcpPractice).toHaveValue(pcpData.pcpName);
      await expect(locator.pcpNumber).toHaveValue(pcpData.formattedPhoneNumber);
    });
  });

  test('PCM. Current medications', async () => {
    await test.step('PCM-1. Open Current medications page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/current-medications`);
      await paperwork.checkCorrectPageOpens('Current medications');
    });

    await test.step('PCM-2. Check required fields', async () => {
      await paperwork.checkRequiredFields('"Select option"', 'Current medications', false);
    });

    await test.step('PCM-3. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PCM-4. Check radio buttons work', async () => {
      await locator.currentMedicationsPresent.click();
      await locator.currentMedicationsAbsent.click();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Current allergies');
    });

    await test.step('PCM-5. Click on [Back] - "Patient does not take medications" is selected', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Current medications');
      await paperworkTelemed.checkEmptyCurrentMedications();
    });

    const medications = await test.step('PCM-6. Fill and check filled medications', async () => {
      return await paperworkTelemed.fillAndCheckFilledCurrentMedications();
    });

    await test.step('PCM-7. Check medications are still filled after reload', async () => {
      await page.reload();
      await paperworkTelemed.checkFilledCurrentMedications([medications.filledValue, medications.selectedValue]);
    });

    await test.step('PCM-8. Delete medications', async () => {
      await locator.deleteButton.nth(0).click();
      await locator.deleteButton.click();
      await paperworkTelemed.checkEnteredDataIsRemoved([medications.filledValue, medications.selectedValue]);
    });

    await test.step('PCM-9. Click [Continue] after removing medications', async () => {
      await locator.clickContinueButton();
      await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
    });
  });

  test('PCA. Current allergies', async () => {
    await test.step('PCA-1. Open Current allergies page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/allergies`);
      await paperwork.checkCorrectPageOpens('Current allergies');
    });

    await test.step('PCA-2. Check required fields', async () => {
      await paperwork.checkRequiredFields('"Select option"', 'Current allergies', false);
    });

    await test.step('PCA-3. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PCA-4. Check radio buttons work', async () => {
      await locator.knownAllergiesPresent.click();
      await locator.knownAllergiesAbsent.click();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Medical history');
    });

    await test.step('PCA-5. Click on [Back] - "Patient has no known current allergies" is selected', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Current allergies');
      await paperworkTelemed.checkEmptyCurrentAllergies();
    });

    const allergies = await test.step('PCA-6. Fill and check filled allergies', async () => {
      return await paperworkTelemed.fillAndCheckFilledCurrentAllergies();
    });

    await test.step('PCA-7. Check allergies are still filled after reload', async () => {
      await page.reload();
      await paperworkTelemed.checkFilledCurrentAllergies([allergies.filledValue, allergies.selectedValue]);
    });

    await test.step('PCA-8. Delete allergies', async () => {
      await locator.deleteButton.nth(0).click();
      await locator.deleteButton.click();
      await paperworkTelemed.checkEnteredDataIsRemoved([allergies.filledValue, allergies.selectedValue]);
    });

    await test.step('PCA-9. Click [Continue] after removing allergies', async () => {
      await locator.clickContinueButton();
      await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
    });
  });

  test('PMH. Medical history', async () => {
    await test.step('PMH-1. Open Medical history page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/medical-history`);
      await paperwork.checkCorrectPageOpens('Medical history');
    });

    await test.step('PMH-2. Check required fields', async () => {
      await paperwork.checkRequiredFields('"Select option"', 'Medical history', false);
    });

    await test.step('PMH-3. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PMH-4. Check radio buttons work', async () => {
      await locator.medicalConditionsPresent.click();
      await locator.medicalConditionsAbsent.click();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Surgical history');
    });

    await test.step('PMH-5. Click on [Back] - "Patient has no current medical conditions" is selected', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Medical history');
      await paperworkTelemed.checkEmptyMedicalHistory();
    });

    const medicalHistory = await test.step('PMH-6. Fill and check filled medical history', async () => {
      return await paperworkTelemed.fillAndCheckFilledMedicalHistory();
    });

    await test.step('PMH-7. Check medical history is still filled after reload', async () => {
      await page.reload();
      await paperworkTelemed.checkFilledMedicalHistory([medicalHistory.filledValue, medicalHistory.selectedValue]);
    });

    await test.step('PMH-8. Delete medical history', async () => {
      await locator.deleteButton.nth(0).click();
      await locator.deleteButton.click();
      await paperworkTelemed.checkEnteredDataIsRemoved([medicalHistory.filledValue, medicalHistory.selectedValue]);
    });

    await test.step('PMH-9. Click [Continue] after removing medical history', async () => {
      await locator.clickContinueButton();
      await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
    });
  });

  test('PSH. Surgical history', async () => {
    await test.step('PSH-1. Open Surgical history page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/surgical-history`);
      await paperwork.checkCorrectPageOpens('Surgical history');
    });

    await test.step('PSH-2. Check required fields', async () => {
      await paperwork.checkRequiredFields('"Select option"', 'Surgical history', false);
    });

    await test.step('PSH-3. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PSH-4. Check radio buttons work', async () => {
      await locator.surgicalHistoryPresent.click();
      await locator.surgicalHistoryAbsent.click();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Additional questions');
    });

    await test.step('PSH-5. Click on [Back] - "Patient has no surgical history" is selected', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Surgical history');
      await paperworkTelemed.checkEmptySurgicalHistory();
    });

    const surgicalHistory = await test.step('PSH-6. Fill and check filled surgical history', async () => {
      return await paperworkTelemed.fillAndCheckFilledSurgicalHistory();
    });

    await test.step('PSH-7. Check surgical history is still filled after reload', async () => {
      await page.reload();
      await paperworkTelemed.checkFilledSurgicalHistory([surgicalHistory.filledValue, surgicalHistory.selectedValue]);
    });

    await test.step('PSH-8. Delete surgical history', async () => {
      await locator.deleteButton.nth(0).click();
      await locator.deleteButton.click();
      await paperworkTelemed.checkEnteredDataIsRemoved([surgicalHistory.filledValue, surgicalHistory.selectedValue]);
    });

    await test.step('PSH-9. Click [Continue] after removing surgical history', async () => {
      await locator.clickContinueButton();
      await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
    });
  });

  test('PAQ. Additional questions', async () => {
    await test.step('PAQ-1. Open Additional questions page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/additional`);
      await paperwork.checkCorrectPageOpens('Additional questions');
    });

    await test.step('PAQ-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PAQ-3. Check page can be skipped', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    });

    await test.step('PAQ-4. Click on [Back] - Additional questions opens', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Additional questions');
    });

    const additionalQuestions = await test.step('PAQ-5. Fill and check filled additional questions', async () => {
      return await paperworkTelemed.fillAndCheckAdditionalQuestions();
    });

    await test.step('PAQ-6. Check additional questions are still filled after reload', async () => {
      await page.reload();
      await paperworkTelemed.checkAdditionalQuestions(additionalQuestions);
    });
  });

  test.describe.serial('Payment option and insurance', () => {
    test('PPO. Payment option', async () => {
      await test.step('PPO-1. Open Payment option page directly', async () => {
        await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      });

      await test.step('PPO-2. Check required fields', async () => {
        await paperwork.checkRequiredFields(
          '"Select payment option"',
          'How would you like to pay for your visit?',
          false
        );
      });

      await test.step('PPO-3. Check patient name is displayed', async () => {
        await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
      });

      await test.step('PPO-4. Select self pay and click [Continue]', async () => {
        await paperwork.selectSelfPayPayment();
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
      });

      await test.step('PPO-5. Select insurance and click [Continue]', async () => {
        await locator.clickBackButton();
        await paperwork.selectInsurancePayment();
        await locator.clickContinueButton();
        // won't navigate without insurance details. expect same page.
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      });
    });

    test('PPI. Primary insurance', async () => {
      await test.step('PPI-1. Open Payment option page directly, select insurance flow', async () => {
        await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
        await paperwork.selectInsurancePayment();
        await expect(locator.insuranceHeading).toBeVisible();
      });

      await test.step('PPI-2. Check required fields', async () => {
        await paperwork.checkRequiredFields(
          '"Insurance carrier","Member ID","Policy holder\'s first name","Policy holder\'s last name","Policy holder\'s date of birth","Policy holder\'s birth sex","Policy holder address","City","State","ZIP","Patient\'s relationship to insured"',
          'How would you like to pay for your visit?',
          true
        );
      });

      await test.step('PPI-3. Select future dob - check validation error', async () => {
        const futureDate = DateTime.now().plus({ years: 1 });
        await locator.policyHolderDOB.fill(futureDate.toFormat('MM/dd/yyyy'));
        await expect(locator.dateFutureError).toBeVisible();
      });

      await test.step('PPI-4. Check zip validation', async () => {
        await paperwork.checkZipValidations(locator.policyHolderZip);
      });

      await test.step('PPI-5. Check policy holder address is the same', async () => {
        await paperwork.checkPolicyAddressIsTheSameCheckbox(false);
      });

      const insuranceData = await test.step('PPI-6. Fill all fields without cards and click [Continue]', async () => {
        const insuranceData = await paperwork.fillInsuranceAllFieldsWithoutCards();
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
        return insuranceData;
      });

      await test.step('PPI-7. Go back and check that data is present', async () => {
        await locator.clickBackButton();
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
        await expect(locator.insuranceCarrier).toHaveValue(insuranceData.insuranceRequiredData.insuranceCarrier);
        await expect(locator.insuranceMemberID).toHaveValue(insuranceData.insuranceRequiredData.insuranceMember);
        await expect(locator.policyHolderDOB).toHaveValue(insuranceData.insuranceRequiredData.paperworkDOB);
        await expect(locator.policyHolderFirstName).toHaveValue(insuranceData.insuranceRequiredData.firstName);
        await expect(locator.policyHolderLastName).toHaveValue(insuranceData.insuranceRequiredData.lastName);
        await expect(locator.policyHolderAddress).toHaveValue(insuranceData.insuranceRequiredData.policyHolderAddress);
        await expect(locator.policyHolderCity).toHaveValue(insuranceData.insuranceRequiredData.policyHolderCity);
        await expect(locator.policyHolderState).toHaveValue(insuranceData.insuranceRequiredData.policyHolderState);
        await expect(locator.policyHolderZip).toHaveValue(insuranceData.insuranceRequiredData.policyHolderZip);
        await expect(locator.policyHolderBirthSex).toHaveValue(insuranceData.insuranceRequiredData.birthSex);
        await expect(locator.patientRelationship).toHaveValue(insuranceData.insuranceRequiredData.relationship);
        await expect(locator.policyHolderMiddleName).toHaveValue(
          insuranceData.insuranceOptionalData.policyHolderMiddleName
        );
        await expect(locator.policyHolderAddressLine2).toHaveValue(
          insuranceData.insuranceOptionalData.policyHolderAddressLine2
        );
      });

      await test.step('PPI-8. Upload and clear insurance cards', async () => {
        const uploadedFrontPhoto = await uploadDocs.fillInsuranceFront();
        await locator.clearImage.click();
        await expect(uploadedFrontPhoto).toBeHidden();
        const uploadedBackPhoto = await uploadDocs.fillInsuranceBack();
        await locator.clearImage.click();
        await expect(uploadedBackPhoto).toBeHidden();
      });

      await test.step('PPI-9. Upload insurance cards, reload the page, check images are saved', async () => {
        await uploadDocs.fillInsuranceFront();
        await uploadDocs.fillInsuranceBack();
        await page.reload();
        await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
        await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
      });

      await test.step('PPI-10. Open next page, click [Back] - check images are saved', async () => {
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
        await locator.clickBackButton();
        await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
        await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
      });

      await test.step('PPI-11. Add secondary insurance with empty fields, remove secondary insurance, continue with only primary insurance', async () => {
        await locator.addSecondaryInsurance.click();
        await locator.clickContinueButton();
        // won't navigate without insurance details. expect same page.
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
        await locator.removeSecondaryInsurance.click();
        await expect(locator.secondaryInsuranceHeading).not.toBeVisible();
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
      });
    });

    test('PSI. Secondary insurance', async () => {
      await test.step('PSI-1. Open Payment option page directly, select insurance flow, fill primary insurance, add secondary insurance', async () => {
        await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
        await paperwork.selectInsurancePayment();
        await paperwork.fillInsuranceAllFieldsWithoutCards();
        await locator.addSecondaryInsurance.click();
        await expect(locator.secondaryInsuranceHeading).toBeVisible();
      });

      await test.step('PSI-2. Check required fields', async () => {
        await paperwork.checkRequiredFields(
          '"Insurance carrier","Member ID","Policy holder\'s first name","Policy holder\'s last name","Policy holder\'s date of birth","Policy holder\'s birth sex","Policy holder address","City","State","ZIP","Patient\'s relationship to insured"',
          'How would you like to pay for your visit?',
          true
        );
      });

      await test.step('PSI-3. Select future dob - check validation error', async () => {
        const futureDate = DateTime.now().plus({ years: 1 });
        await locator.secondaryPolicyHolderDOB.fill(futureDate.toFormat('MM/dd/yyyy'));
        await expect(locator.dateFutureError).toBeVisible();
      });

      await test.step('PSI-4. Check zip validation', async () => {
        await paperwork.checkZipValidations(locator.policyHolderZip);
      });

      await test.step('PSI-5. Check policy holder address is the same', async () => {
        await paperwork.checkPolicyAddressIsTheSameCheckbox(true);
      });

      const insuranceData = await test.step('PSI-6. Fill all fields without cards and click [Continue]', async () => {
        const insuranceData = await paperwork.fillSecondaryInsuranceAllFieldsWithoutCards();
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
        return insuranceData;
      });

      await test.step('PSI-7. Go back and check that data is present', async () => {
        await locator.clickBackButton();
        await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
        await expect(locator.secondaryInsuranceCarrier).toHaveValue(
          insuranceData.insuranceRequiredData.insuranceCarrier
        );
        await expect(locator.secondaryInsuranceMemberID).toHaveValue(
          insuranceData.insuranceRequiredData.insuranceMember
        );
        await expect(locator.secondaryPolicyHolderDOB).toHaveValue(insuranceData.insuranceRequiredData.paperworkDOB);
        await expect(locator.secondaryPolicyHolderFirstName).toHaveValue(insuranceData.insuranceRequiredData.firstName);
        await expect(locator.secondaryPolicyHolderLastName).toHaveValue(insuranceData.insuranceRequiredData.lastName);
        await expect(locator.secondaryPolicyHolderAddress).toHaveValue(
          insuranceData.insuranceRequiredData.policyHolderAddress
        );
        await expect(locator.secondaryPolicyHolderCity).toHaveValue(
          insuranceData.insuranceRequiredData.policyHolderCity
        );
        await expect(locator.secondaryPolicyHolderState).toHaveValue(
          insuranceData.insuranceRequiredData.policyHolderState
        );
        await expect(locator.secondaryPolicyHolderZip).toHaveValue(insuranceData.insuranceRequiredData.policyHolderZip);
        await expect(locator.secondaryPolicyHolderBirthSex).toHaveValue(insuranceData.insuranceRequiredData.birthSex);
        await expect(locator.secondaryPatientRelationship).toHaveValue(
          insuranceData.insuranceRequiredData.relationship
        );
        await expect(locator.secondaryPolicyHolderMiddleName).toHaveValue(
          insuranceData.insuranceOptionalData.policyHolderMiddleName
        );
        await expect(locator.secondaryPolicyHolderAddressLine2).toHaveValue(
          insuranceData.insuranceOptionalData.policyHolderAddressLine2
        );
      });

      await test.step('PSI-8. Upload and clear insurance cards', async () => {
        const uploadedFrontPhoto = await uploadDocs.fillSecondaryInsuranceFront();
        await locator.clearImage.click();
        await expect(uploadedFrontPhoto).toBeHidden();
        const uploadedBackPhoto = await uploadDocs.fillSecondaryInsuranceBack();
        await locator.clearImage.click();
        await expect(uploadedBackPhoto).toBeHidden();
      });

      await test.step('PSI-9. Upload insurance cards, reload the page, check images are saved', async () => {
        await uploadDocs.fillSecondaryInsuranceFront();
        await uploadDocs.fillSecondaryInsuranceBack();
        await page.reload();
        await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
        await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
      });

      await test.step('PSI-10. Open next page, click [Back] - check images are saved', async () => {
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Credit card details');
        await locator.clickBackButton();
        await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
        await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
      });
    });
  });

  test('PRPI. Responsible party information', async () => {
    await test.step('PRPI-1. Open responsible party information page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/responsible-party`);
      await paperwork.checkCorrectPageOpens('Responsible party information');
    });

    await test.step('PRPI-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PRPI-3. Check required fields', async () => {
      await paperwork.checkRequiredFields(
        '"Relationship to the patient","First name","Last name","Date of birth","Birth sex"',
        'Responsible party information',
        true
      );
    });

    await test.step('PRPI-4. Check phone field validation', async () => {
      await paperwork.checkPhoneValidations(locator.responsiblePartyNumber);
    });

    await test.step('PRPI-5. Check email field validation', async () => {
      await paperwork.checkEmailValidations(locator.responsiblePartyEmail);
    });

    await test.step('PRPI-6. Select self - check fields are prefilled with correct values', async () => {
      const { y, m, d } = patient.dob;
      const humanReadableDob = commonLocatorsHelper.getMonthDay(m, d);
      if (!humanReadableDob) {
        throw new Error('DOB data is null');
      }
      await paperwork.fillResponsiblePartyDataSelf();
      await expect(locator.responsiblePartyFirstName).toHaveValue(patient.firstName);
      await expect(locator.responsiblePartyLastName).toHaveValue(patient.lastName);
      await expect(locator.responsiblePartyBirthSex).toHaveValue(patient.birthSex);
      await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
        `${humanReadableDob?.monthNumber}/${humanReadableDob?.dayNumber}/${y}`
      );
    });

    await test.step('PRPI-7. Select self - check fields are disabled', async () => {
      expect(locator.responsiblePartyFirstName.getAttribute('disabled')).not.toBeNull();
      expect(locator.responsiblePartyLastName.getAttribute('disabled')).not.toBeNull();
      expect(locator.responsiblePartyBirthSex.getAttribute('disabled')).not.toBeNull();
      expect(locator.responsiblePartyDOBAnswer.getAttribute('disabled')).not.toBeNull();
    });

    await test.step('PRPI-8. Select not self - check fields are empty', async () => {
      await paperwork.fillResponsiblePartyNotSelfRelationship();
      await expect(locator.responsiblePartyFirstName).toHaveValue('');
      await expect(locator.responsiblePartyLastName).toHaveValue('');
      await expect(locator.responsiblePartyDOBAnswer).toHaveValue('');
    });

    await test.step('PRPI-9. Select future dob - check validation error', async () => {
      const futureDate = DateTime.now().plus({ years: 1 });
      const dobLocator = locator.responsiblePartyDOBAnswer;
      await dobLocator.fill(futureDate.toFormat('MM/dd/yyyy'));
      await expect(locator.dateFutureError).toBeVisible();
    });

    const responsiblePartyData = await test.step('PRPI-10. Fill all fields and click [Continue]', async () => {
      const responsiblePartyData = await paperwork.fillResponsiblePartyDataNotSelf();
      await expect(locator.dateOlder18YearsError).not.toBeVisible();
      await expect(locator.dateFutureError).not.toBeVisible();
      await locator.clickContinueButton();
      // Check which page appears (employer information is conditional)
      const currentPageTitle = await locator.flowHeading.textContent();
      if (currentPageTitle === 'Employer information') {
        // If employer information page is shown, we'll handle it in the PEI test
      } else {
        await paperwork.checkCorrectPageOpens('Emergency Contact');
      }
      return responsiblePartyData;
    });

    await test.step('PRPI-11. Click on [Back] - all values are saved', async () => {
      await locator.clickBackButton();
      await expect(locator.responsiblePartyFirstName).toHaveValue(responsiblePartyData.firstName);
      await expect(locator.responsiblePartyLastName).toHaveValue(responsiblePartyData.lastName);
      await expect(locator.responsiblePartyBirthSex).toHaveValue(responsiblePartyData.birthSex);
      await expect(locator.responsiblePartyRelationship).toHaveValue(responsiblePartyData.relationship);
      await expect(locator.responsiblePartyDOBAnswer).toHaveValue(responsiblePartyData.dob);
      await expect(locator.responsiblePartyAddress1).toHaveValue(responsiblePartyData.address1);
      await expect(locator.responsiblePartyCity).toHaveValue(responsiblePartyData.city);
      await expect(locator.responsiblePartyState).toHaveValue(responsiblePartyData.state);
      await expect(locator.responsiblePartyZip).toHaveValue(responsiblePartyData.zip);
      await expect(locator.responsiblePartyNumber).toHaveValue(responsiblePartyData.phone);
      await expect(locator.responsiblePartyEmail).toHaveValue(responsiblePartyData.email);
    });
  });

  test('PEI. Employer information', async () => {
    test.skip(
      (() => {
        // Get the appointment service category that would be selected during test flow
        const firstServiceCategory = BOOKING_CONFIG.serviceCategories[0];
        if (!firstServiceCategory) {
          return true; // Skip if no service categories configured
        }

        // Create minimal response context with just the service category
        const responseItems: QuestionnaireResponseItem[] = [
          {
            linkId: 'contact-information-page',
            item: [
              {
                linkId: 'appointment-service-category',
                answer: [{ valueString: firstServiceCategory.code }],
              },
            ],
          },
        ];

        // Check if employer page would be visible for this service category
        return !QuestionnaireHelper.employerInformationPageIsVisible(responseItems);
      })(),
      'Employer information page not visible for this appointment type'
    );
    await test.step('PEI-1. Open employer information page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/employer-information`);
      await paperwork.checkCorrectPageOpens('Employer information');
    });

    await test.step('PEI-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PEI-3. Check required fields', async () => {
      await paperwork.checkRequiredFields(
        '"Employer Name","Employer Address","City","State","ZIP","First name","Last name","Mobile"',
        'Employer information',
        true
      );
    });

    const employerInformationData = await test.step('PEI-4. Fill all fields and click on [Continue]', async () => {
      const employerInformationData = await paperwork.fillEmployerInformation();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Emergency Contact');
      return employerInformationData;
    });

    await test.step('PEI-5. Click on [Back] - all values are saved', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Employer information');
      await expect(locator.employerName).toHaveValue(employerInformationData.employerName);
      await expect(locator.employerAddress1).toHaveValue(employerInformationData.address1);
      await expect(locator.employerAddress2).toHaveValue(employerInformationData.address2);
      await expect(locator.employerCity).toHaveValue(employerInformationData.city);
      await expect(locator.employerState).toHaveValue(employerInformationData.state);
      await expect(locator.employerZip).toHaveValue(employerInformationData.zip);
      await expect(locator.employerContactFirstName).toHaveValue(employerInformationData.contactFirstName);
      await expect(locator.employerContactLastName).toHaveValue(employerInformationData.contactLastName);
      await expect(locator.employerContactTitle).toHaveValue(employerInformationData.contactTitle);
      await expect(locator.employerContactEmail).toHaveValue(employerInformationData.contactEmail);
      await expect(locator.employerContactPhone).toHaveValue(employerInformationData.contactPhone);
      await expect(locator.employerContactFax).toHaveValue(employerInformationData.contactFax);
    });
  });

  test('PEC. Emergency Contact', async () => {
    await test.step('PEC-1. Open Emergency Contact page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/emergency-contact`);
      await paperwork.checkCorrectPageOpens('Emergency Contact');
    });

    await test.step('PEC-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PEC-3. Check required fields', async () => {
      await paperwork.checkRequiredFields(
        '"Relationship to the patient","Emergency contact first name","Emergency contact last name","Emergency contact phone","Address","City","State","ZIP"',
        'Emergency Contact',
        true
      );
    });

    const emergencyContactData = await test.step('PEC-4. Fill all fields and click on [Continue]', async () => {
      const emergencyContactData = await paperwork.fillEmergencyContactInformation();
      await locator.clickContinueButton();
      // Check which page appears (attorney information is conditional)
      await expect(locator.flowHeading).not.toHaveText('Loading...', { timeout: 60000 });
      const currentPageTitle = await locator.flowHeading.textContent();
      if (currentPageTitle === 'Attorney for Motor Vehicle Accident') {
        // If attorney page is shown, we'll handle it in the PAI test
      } else {
        await paperwork.checkCorrectPageOpens('Photo ID');
      }
      return emergencyContactData;
    });

    await test.step('PEC-5. Click on [Back] - all values are saved', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Emergency Contact');
      await expect(locator.emergencyContactInformationRelationship).toHaveValue(emergencyContactData.relationship);
      await expect(locator.emergencyContactInformationFirstName).toHaveValue(emergencyContactData.firstName);
      await expect(locator.emergencyContactInformationLastName).toHaveValue(emergencyContactData.lastName);
      await expect(locator.emergencyContactInformationPhone).toHaveValue(emergencyContactData.phone);
      await expect(locator.emergencyContactAddress).toHaveValue(emergencyContactData.address);
      await expect(locator.emergencyContactAddressLine2).toHaveValue(emergencyContactData.addressLine2);
      await expect(locator.emergencyContactCity).toHaveValue(emergencyContactData.city);
      await expect(locator.emergencyContactState).toHaveValue(emergencyContactData.state);
      await expect(locator.emergencyContactZip).toHaveValue(emergencyContactData.zip);
    });
  });

  test('PAI. Attorney information', async () => {
    test.skip(
      (() => {
        const responseItems: QuestionnaireResponseItem[] = [
          {
            linkId: 'contact-information-page',
            item: [
              {
                linkId: 'reason-for-visit',
                answer: [{ valueString: patient.reasonForVisit }],
              },
            ],
          },
        ];
        // Check if attorney page would be visible for this reason for visit
        return !QuestionnaireHelper.attorneyPageIsVisible(responseItems);
      })(),
      'Attorney page not visible for this appointment type'
    );
    await test.step('PAI-1. Open attorney information page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/attorney-mva`);
      await paperwork.checkCorrectPageOpens('Attorney for Motor Vehicle Accident');
    });

    await test.step('PAI-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PAI-3. Check required fields', async () => {
      // Select "I have an attorney" option
      await locator.attorneyHasAttorney.click();

      await paperwork.checkRequiredFields('"Firm"', 'Attorney for Motor Vehicle Accident', false);
    });

    const attorneyInformationData = await test.step('PAI-4. Fill all fields and click on [Continue]', async () => {
      const attorneyInformationData = await paperwork.fillAttorneyInformation();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Photo ID');
      return attorneyInformationData;
    });

    await test.step('PAI-5. Click on [Back] - all values are saved', async () => {
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Attorney for Motor Vehicle Accident');
      await expect(locator.attorneyHasAttorney).toHaveValue(attorneyInformationData.hasAttorney);
      await expect(locator.attorneyFirm).toHaveValue(attorneyInformationData.firm);
      await expect(locator.attorneyFirstName).toHaveValue(attorneyInformationData.firstName);
      await expect(locator.attorneyLastName).toHaveValue(attorneyInformationData.lastName);
      await expect(locator.attorneyEmail).toHaveValue(attorneyInformationData.email);
      await expect(locator.attorneyMobile).toHaveValue(attorneyInformationData.mobile);
      await expect(locator.attorneyFax).toHaveValue(attorneyInformationData.fax);
    });
  });

  test('PPID. Photo ID', async () => {
    await test.step('PPID-1. Open photo ID page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/photo-id`);
      await paperwork.checkCorrectPageOpens('Photo ID');
    });

    await test.step('PPID-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PPID-3. Upload and Clear images', async () => {
      const uploadedFrontPhoto = await uploadDocs.fillPhotoFrontID();
      await locator.clearImage.click();
      await expect(uploadedFrontPhoto).toBeHidden();
      const uploadedBackPhoto = await uploadDocs.fillPhotoBackID();
      await locator.clearImage.click();
      await expect(uploadedBackPhoto).toBeHidden();
    });

    await test.step('PPID-4. Upload images, reload the page, check images are saved', async () => {
      await uploadDocs.fillPhotoFrontID();
      await uploadDocs.fillPhotoBackID();
      await page.reload();
      await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
      await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
    });

    await test.step('PPID-5. Open next page, click [Back] - check images are saved', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Patient condition');
      await locator.clickBackButton();
      await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
      await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
    });
  });

  test('PPC. Patient condition', async () => {
    await test.step('PPC-1. Open Patient condition page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/patient-condition`);
      await paperwork.checkCorrectPageOpens('Patient condition');
    });

    await test.step('PPC-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PPC-3. Upload and Clear image', async () => {
      const uploadedPhoto = await uploadDocs.fillPatientConditionPhotoPaperwork();
      await locator.clearImage.click();
      await expect(uploadedPhoto).toBeHidden();
    });

    await test.step('PPC-4. Upload image, reload page, check image is saved', async () => {
      await uploadDocs.fillPatientConditionPhotoPaperwork();
      await page.reload();
      await paperwork.checkImagesIsSaved(locator.photoPatientCondition);
    });

    await test.step('PPC-5. Open next page, click [Back] - check images are saved', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
      await locator.clickBackButton();
      await paperwork.checkImagesIsSaved(locator.photoPatientCondition);
    });
  });

  test('PSWN. School/work notes', async () => {
    await test.step('PSWN-1. Open School/work note page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/school-work-note`);
      await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
    });

    await test.step('PSWN-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PSWN-3. Check required fields', async () => {
      await paperwork.checkRequiredFields('"Select option:"', 'Do you need a school or work note?', false);
    });

    await test.step('PSWN-4. Select Neither option, templates block is hidden', async () => {
      await locator.neitherNotes.click();
      await expect(locator.templatesBlock).not.toBeVisible();
    });

    await test.step('PSWN-5. Check School only option works', async () => {
      await locator.schoolOnlyNotes.click();

      await test.step('PSWN-5.1. Verify correct template block is visible', async () => {
        await expect(locator.templatesBlock).toBeVisible();
        await expect(locator.schoolTemplateLabel).toBeVisible();
        await expect(locator.uploadSchoolTemplate).toBeVisible();
        await expect(locator.workTemplateLabel).not.toBeVisible();
        await expect(locator.uploadWorkTemplate).not.toBeVisible();
      });

      await test.step('PSWN-5.2. Verify option is still selected when navigating to next page and back', async () => {
        await locator.clickContinueButton(true);
        await locator.clickBackButton();
        await expect(locator.schoolOnlyNotes).toBeChecked();
      });

      const uploadedSchoolTemplate =
        await test.step('PSWN-5.3. Upload file, verify link value, attributes, and that it opens pdf', async () => {
          const uploadedSchoolTemplate = await uploadDocs.uploadFile(
            locator.uploadSchoolTemplate,
            locator.schoolNoteFile
          );
          const currentLink = await locator.schoolNoteFile.getAttribute('href');
          expect(uploadedSchoolTemplate.link).toBe(currentLink);
          await commonLocatorsHelper.checkLinkOpensPdf(locator.schoolNoteFile);
          return uploadedSchoolTemplate;
        });

      await test.step('PSWN-5.4. Remove uploaded file, verify file is removed', async () => {
        await locator.removeFile.click();
        await expect(uploadedSchoolTemplate.uploadedFile).toBeHidden();
      });
    });

    await test.step('PSWN-6. Check Work only option works', async () => {
      await locator.workOnlyNotes.click();

      await test.step('PSWN-6.1. Verify correct template block is visible', async () => {
        await expect(locator.templatesBlock).toBeVisible();
        await expect(locator.schoolTemplateLabel).not.toBeVisible();
        await expect(locator.uploadSchoolTemplate).not.toBeVisible();
        await expect(locator.workTemplateLabel).toBeVisible();
        await expect(locator.uploadWorkTemplate).toBeVisible();
      });

      await test.step('PSWN-6.2. Verify option is still selected when navigating to next page and back', async () => {
        await locator.clickContinueButton(true);
        await locator.clickBackButton();
        await expect(locator.workOnlyNotes).toBeChecked();
      });

      const uploadedWorkTemplate =
        await test.step('PSWN-6.3. Upload file, verify link value, attributes, and that it opens pdf', async () => {
          const uploadedWorkTemplate = await uploadDocs.uploadFile(locator.uploadWorkTemplate, locator.workNoteFile);
          const currentLink = await locator.workNoteFile.getAttribute('href');
          expect(uploadedWorkTemplate.link).toBe(currentLink);
          await commonLocatorsHelper.checkLinkOpensPdf(locator.workNoteFile);
          return uploadedWorkTemplate;
        });

      await test.step('PSWN-6.4. Remove uploaded file, verify file is removed', async () => {
        await locator.removeFile.click();
        await expect(uploadedWorkTemplate.uploadedFile).toBeHidden();
      });
    });

    await test.step('PSWN-7. Check Both only option works', async () => {
      await locator.schoolAndWorkNotes.click();

      await test.step('PSWN-7.1. Verify correct template block is visible', async () => {
        await expect(locator.templatesBlock).toBeVisible();
        await expect(locator.schoolTemplateLabel).toBeVisible();
        await expect(locator.uploadSchoolTemplate).toBeVisible();
        await expect(locator.workTemplateLabel).toBeVisible();
        await expect(locator.uploadWorkTemplate).toBeVisible();
      });

      const { uploadedSchoolTemplate, uploadedWorkTemplate } = await test.step('PSWN-7.2. Upload files', async () => {
        const uploadedSchoolTemplate = await uploadDocs.uploadFile(
          locator.uploadSchoolTemplate,
          locator.schoolNoteFile
        );
        const uploadedWorkTemplate = await uploadDocs.uploadFile(locator.uploadWorkTemplate, locator.workNoteFile);
        return { uploadedSchoolTemplate, uploadedWorkTemplate };
      });

      // todo uncomment lines in PSWN-7.3 and remove skip for PSWN-7.4 when https://github.com/masslight/ottehr/issues/1671 is fixed
      const { currentSchoolLink, currentWorkLink } =
        await test.step('PSWN-7.3. Verify option is still selected and templates are saved when navigating to next page and back', async () => {
          await locator.clickContinueButton(true);
          await locator.clickBackButton();
          await expect(locator.schoolAndWorkNotes).toBeChecked();

          // await expect(uploadedSchoolTemplate.uploadedFile).toBeVisible();
          const currentSchoolLink = await locator.schoolNoteFile.getAttribute('href');
          // expect(uploadedSchoolTemplate!.link).toBe(currentSchoolLink);

          // await expect(uploadedWorkTemplate.uploadedFile).toBeVisible();
          const currentWorkLink = await locator.workNoteFile.getAttribute('href');
          // expect(uploadedWorkTemplate!.link).toBe(currentWorkLink);

          return { currentSchoolLink, currentWorkLink };
        });

      await test.step.skip('PSWN-7.4. Reload page, check link values', async () => {
        await page.reload();
        expect(uploadedSchoolTemplate!.link).toBe(currentSchoolLink);
        expect(uploadedWorkTemplate!.link).toBe(currentWorkLink);
      });
    });
  });

  test('PCF. Consent forms', async () => {
    await test.step('PCF-1. Open consent forms page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/consent-forms`);
      await paperwork.checkCorrectPageOpens('Complete consent forms');
    });

    await test.step('PCF-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    // todo these should come from config!
    // await test.step('PCF-3. Check required fields', async () => {
    //   await paperwork.checkRequiredFields(
    //     '"I have reviewed and accept HIPAA Acknowledgement","I have reviewed and accept Consent to Treat, Guarantee of Payment & Card on File Agreement","Signature","Full name","Relationship to the patient"',
    //     'Complete consent forms',
    //     true
    //   );
    // });

    // await test.step('PCF-4. Check links are correct', async () => {
    //   expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'href')).toBe('/hipaa_notice_template.pdf');
    //   expect(
    //     await page.getAttribute('a:has-text("Consent to Treat, Guarantee of Payment & Card on File Agreement")', 'href')
    //   ).toBe('/consent_to_treat_template.pdf');
    // });

    // await test.step('PCF-5. Check links opens in new tab', async () => {
    //   expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'target')).toBe('_blank');
    //   expect(
    //     await page.getAttribute(
    //       'a:has-text("Consent to Treat, Guarantee of Payment & Card on File Agreement")',
    //       'target'
    //     )
    //   ).toBe('_blank');
    // });

    await test.step('PCF-6. Fill all data and click on [Continue]', async () => {
      await paperwork.fillConsentForms();
      await locator.clickContinueButton();
      // Given we've opened the page directly and didn't fill all the paperwork this is expected.
      await expect(page.getByText(`Error validating form`)).toBeVisible();
    });
  });

  test('PIP. Invite participant', async () => {
    await test.step('PIP-1. Open invite participant page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/invite-participant`);
      await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
    });

    await test.step('PIP-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PIP-4. Select "No" and click [Continue]', async () => {
      await paperworkTelemed.fillAndCheckNoInviteParticipant();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
    });

    await test.step('PIP-5. Select "Yes" and check required fields', async () => {
      await locator.inviteParticipantYes.click();

      await test.step('PIP-5.1. Check default required fields', async () => {
        await paperwork.checkRequiredFields(
          '"First name","Last name","Preferable contact"',
          'Would you like someone to join this call?',
          true
        );
      });

      await test.step('PIP-5.2. Select "Email" and check required fields and validations', async () => {
        await locator.inviteeContactEmail.click();
        await paperwork.checkRequiredFields(
          '"First name","Last name","Email address"',
          'Would you like someone to join this call?',
          true
        );
        await paperwork.checkEmailValidations(locator.inviteeEmail);
      });

      await test.step('PIP-5.3. Select "Phone" and check required fields and validations', async () => {
        await locator.inviteeContactPhone.click();
        await paperwork.checkRequiredFields(
          '"First name","Last name","Phone number"',
          'Would you like someone to join this call?',
          true
        );
        await paperwork.checkPhoneValidations(locator.inviteePhone);
      });
    });

    await test.step('PIP-6. Invite participant by phone', async () => {
      const inviteeData = await paperworkTelemed.fillInviteParticipant('phone', 'paperwork');

      await test.step('PIP-6.1. Data is saved after reload', async () => {
        await page.reload();
        await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
        await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
        await expect(locator.inviteePhone).toHaveValue(inviteeData.phone!);
        await expect(locator.inviteeContactPhone).toBeChecked();
      });

      await test.step('PIP-6.2. Data is saved after coming back', async () => {
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Review and submit');
        await locator.clickBackButton();
        await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
        await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
        await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
        await expect(locator.inviteePhone).toHaveValue(inviteeData.phone!);
        await expect(locator.inviteeContactPhone).toBeChecked();
      });
    });

    await test.step('PIP-7. Invite participant by email', async () => {
      const inviteeData = await paperworkTelemed.fillInviteParticipant('email', 'paperwork');

      await test.step('PIP-7.1. Data is saved after reload', async () => {
        await page.reload();
        await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
        await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
        await expect(locator.inviteeEmail).toHaveValue(inviteeData.email!);
        await expect(locator.inviteeContactEmail).toBeChecked();
      });

      await test.step('PIP-7.2. Data is saved after coming back', async () => {
        await locator.clickContinueButton();
        await paperwork.checkCorrectPageOpens('Review and submit');
        await locator.clickBackButton();
        await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
        await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
        await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
        await expect(locator.inviteeEmail).toHaveValue(inviteeData.email!);
        await expect(locator.inviteeContactEmail).toBeChecked();
      });
    });
  });
});
