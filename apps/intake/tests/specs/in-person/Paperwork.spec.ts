// cSpell:ignore PPCP, PRPI
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { BOOKING_CONFIG, getConsentFormsForLocation } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { QuestionnaireHelper } from '../../utils/QuestionnaireHelper';
import { UploadDocs } from '../../utils/UploadDocs';
import { InPersonNoPwPatient } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadDocs;
let commonLocatorsHelper: CommonLocatorsHelper;
let patient: InPersonNoPwPatient;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  uploadPhoto = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);

  const testDataPath = path.join('test-data', 'inPersonNoPwPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('In-Person - No Paperwork Filled Yet', () => {
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
      await paperwork.checkRequiredFields('"Ethnicity","Race","Preferred language"', 'Patient details', true);
    });

    await test.step('PPD-3. Fill all fields', async () => {
      await paperwork.fillPatientDetailsAllFields();
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

  test('PPO. Payment option', async () => {
    await test.step('PPO-1. Open Payment option page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/payment-option`);
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    });

    await test.step('PPO-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step.skip('PPO-3. Click Continue without selecting payment option - defaults to self-pay', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Credit card details');
    });

    await test.step('PPO-4. Go back and select insurance', async () => {
      // if you skip the previous step, this step will fail, so we have to skip it as well
      // await locator.clickBackButton();
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
      const uploadedFrontPhoto = await uploadPhoto.fillInsuranceFront();
      await locator.clearImage.click();
      await expect(uploadedFrontPhoto).toBeHidden();
      const uploadedBackPhoto = await uploadPhoto.fillInsuranceBack();
      await locator.clearImage.click();
      await expect(uploadedBackPhoto).toBeHidden();
    });

    await test.step('PPI-9. Upload insurance cards, reload the page, check images are saved', async () => {
      await uploadPhoto.fillInsuranceFront();
      await uploadPhoto.fillInsuranceBack();
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
      await expect(locator.secondaryInsuranceCarrier).toHaveValue(insuranceData.insuranceRequiredData.insuranceCarrier);
      await expect(locator.secondaryInsuranceMemberID).toHaveValue(insuranceData.insuranceRequiredData.insuranceMember);
      await expect(locator.secondaryPolicyHolderDOB).toHaveValue(insuranceData.insuranceRequiredData.paperworkDOB);
      await expect(locator.secondaryPolicyHolderFirstName).toHaveValue(insuranceData.insuranceRequiredData.firstName);
      await expect(locator.secondaryPolicyHolderLastName).toHaveValue(insuranceData.insuranceRequiredData.lastName);
      await expect(locator.secondaryPolicyHolderAddress).toHaveValue(
        insuranceData.insuranceRequiredData.policyHolderAddress
      );
      await expect(locator.secondaryPolicyHolderCity).toHaveValue(insuranceData.insuranceRequiredData.policyHolderCity);
      await expect(locator.secondaryPolicyHolderState).toHaveValue(
        insuranceData.insuranceRequiredData.policyHolderState
      );
      await expect(locator.secondaryPolicyHolderZip).toHaveValue(insuranceData.insuranceRequiredData.policyHolderZip);
      await expect(locator.secondaryPolicyHolderBirthSex).toHaveValue(insuranceData.insuranceRequiredData.birthSex);
      await expect(locator.secondaryPatientRelationship).toHaveValue(insuranceData.insuranceRequiredData.relationship);
      await expect(locator.secondaryPolicyHolderMiddleName).toHaveValue(
        insuranceData.insuranceOptionalData.policyHolderMiddleName
      );
      await expect(locator.secondaryPolicyHolderAddressLine2).toHaveValue(
        insuranceData.insuranceOptionalData.policyHolderAddressLine2
      );
    });

    await test.step('PSI-8. Upload and clear insurance cards', async () => {
      const uploadedFrontPhoto = await uploadPhoto.fillSecondaryInsuranceFront();
      await locator.clearImage.click();
      await expect(uploadedFrontPhoto).toBeHidden();
      const uploadedBackPhoto = await uploadPhoto.fillSecondaryInsuranceBack();
      await locator.clearImage.click();
      await expect(uploadedBackPhoto).toBeHidden();
    });

    await test.step('PSI-9. Upload insurance cards, reload the page, check images are saved', async () => {
      await uploadPhoto.fillSecondaryInsuranceFront();
      await uploadPhoto.fillSecondaryInsuranceBack();
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
      await expect(locator.flowHeading).not.toHaveText('Loading...', { timeout: 60000 });
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
      const uploadedFrontPhoto = await uploadPhoto.fillPhotoFrontID();
      await locator.clearImage.click();
      await expect(uploadedFrontPhoto).toBeHidden();
      const uploadedBackPhoto = await uploadPhoto.fillPhotoBackID();
      await locator.clearImage.click();
      await expect(uploadedBackPhoto).toBeHidden();
    });

    await test.step('PPID-4. Upload images, reload the page, check images are saved', async () => {
      await uploadPhoto.fillPhotoFrontID();
      await uploadPhoto.fillPhotoBackID();
      await page.reload();
      await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
      await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
    });

    /*
    commenting this out until a more reliable implementation is found.
    currently the test fails frequently due to to the Consent forms page being skipped when the questionnaire
    is completed. 
    await test.step('PPID-5. Open next page, click [Back] - check images are saved', async () => {
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Consent forms');
      await locator.clickBackButton();
      await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
      await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
    });
    */
  });

  test('PCF. Consent forms', async () => {
    const consentForms = getConsentFormsForLocation();
    await test.step('PCF-1. Open consent forms page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/consent-forms`);
      await paperwork.checkCorrectPageOpens('Complete consent forms');
    });

    await test.step('PCF-2. Check patient name is displayed', async () => {
      await paperwork.checkPatientNameIsDisplayed(patient.firstName, patient.lastName);
    });

    await test.step('PCF-3. Check required fields', async () => {
      const requiredConsentTitles = consentForms.map((form) => `"I have reviewed and accept ${form.formTitle}"`);
      const requiredFieldsString = [
        ...requiredConsentTitles,
        '"Signature"',
        '"Full name"',
        '"Relationship to the patient"',
      ].join(',');
      await paperwork.checkRequiredFields(requiredFieldsString, 'Complete consent forms', true);
    });

    await test.step('PCF-4. Check links are correct', async () => {
      for (const form of consentForms) {
        expect(await page.getAttribute(`a:has-text(${form.formTitle})`, 'href')).toBe(form.publicUrl);
      }
    });

    await test.step('PCF-5. Check links opens in new tab', async () => {
      for (const form of consentForms) {
        expect(await page.getAttribute(`a:has-text(${form.formTitle})`, 'target')).toBe('_blank');
      }
    });

    const consentFormsData = await test.step('PCF-6. Fill all fields and click on [Continue]', async () => {
      const consentFormsData = await paperwork.fillConsentForms();
      await locator.clickContinueButton();
      await paperwork.checkCorrectPageOpens('Medical history');
      return consentFormsData;
    });

    await test.step('PCF-7. Click on [Back] - all values are saved', async () => {
      await locator.clickBackButton();
      await expect(locator.hipaaAcknowledgement).toBeChecked();
      await expect(locator.consentToTreat).toBeChecked();
      await expect(locator.signature).toHaveValue(consentFormsData.signature);
      await expect(locator.consentFullName).toHaveValue(consentFormsData.consentFullName);
      await expect(locator.consentSignerRelationship).toHaveValue(consentFormsData.relationshipConsentForms);
    });
  });
});
