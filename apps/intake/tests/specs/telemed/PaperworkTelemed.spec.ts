// cSpell:ignore networkidle, PPCP, PRPI, PSWN
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { PaperworkTelemed } from '../../utils/telemed/Paperwork';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { UploadDocs, UploadedFile } from '../../utils/UploadDocs';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookTelemedFlow;
let bookingData: Awaited<ReturnType<PrebookTelemedFlow['startVisitFullFlow']>>;
let paperwork: Paperwork;
let paperworkTelemed: PaperworkTelemed;
let medications: Awaited<ReturnType<PaperworkTelemed['fillAndCheckFilledCurrentMedications']>>;
let medHistory: Awaited<ReturnType<PaperworkTelemed['fillAndCheckFilledMedicalHistory']>>;
let surgicalHistory: Awaited<ReturnType<PaperworkTelemed['fillAndCheckFilledSurgicalHistory']>>;
let allergies: Awaited<ReturnType<PaperworkTelemed['fillAndCheckFilledCurrentAllergies']>>;
let additionalQuestions: Awaited<ReturnType<PaperworkTelemed['fillAndCheckAdditionalQuestions']>>;
let locator: Locators;
let uploadDocs: UploadDocs;
let pcpData: Awaited<ReturnType<Paperwork['fillPrimaryCarePhysician']>>;
let insuranceData: Awaited<ReturnType<Paperwork['fillInsuranceAllFieldsWithoutCards']>>;
let secondaryInsuranceData: Awaited<ReturnType<Paperwork['fillSecondaryInsuranceAllFieldsWithoutCards']>>;
let responsiblePartyData: Awaited<ReturnType<Paperwork['fillResponsiblePartyDataNotSelf']>>;
let consentFormsData: Awaited<ReturnType<Paperwork['fillConsentForms']>>;
let inviteeData: Awaited<ReturnType<PaperworkTelemed['fillInviteParticipant']>>;
let commonLocatorsHelper: CommonLocatorsHelper;
const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      if (!appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
    }
  });
  flowClass = new PrebookTelemedFlow(page);
  paperwork = new Paperwork(page);
  paperworkTelemed = new PaperworkTelemed(page);
  locator = new Locators(page);
  uploadDocs = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  console.log('getting booking data...');
  bookingData = await flowClass.startVisitFullFlow();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Contact information screen - Check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PCI-1 Click on [Proceed to paperwork] - Contact information screen opens', async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.checkCorrectPageOpens('Contact information');
  });
  test('PCI-2 Fill Contact Information all fields', async () => {
    await paperwork.fillContactInformationAllFields();
  });
  test('PCI-3 Contact Information - Check email is prefilled', async () => {
    await paperwork.checkEmailIsPrefilled(bookingData.patientBasicInfo.email);
  });
  test('PCI-4 Contact Information - Check mobile is prefilled', async () => {
    await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
  });
  test('PCI-5 Contact Information - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPD-1 Click on [Continue] - Patient details screen opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Patient details');
  });
});
test.describe('Patient details screen - Check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPD-0 Open Patient details', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/patient-details`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Patient details');
  });
  test('PPD-1 Check required fields', async () => {
    await paperwork.checkRequiredFields(
      '"Ethnicity","Race","Preferred language","Do you require a Hearing Impaired Relay Service? (711)"',
      'Patient details',
      true
    );
  });
  test('PPD-2 Fill Patient details all fields', async () => {
    await paperwork.fillPatientDetailsTelemedAllFields();
  });
  test('PPD-3 Patient details - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPD-4 Patient details - Fill not listed pronoun', async () => {
    await paperwork.fillNotListedPronouns();
  });
  test('PPD-5 Click on [Continue] - Primary Care Physician', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
});
test.describe('Primary Care Physician - Check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPCP-0 Open Primary Care Physician', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/primary-care-physician`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
  test('PPCP-1 Primary Care Physician - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPCP-2 Click on [Continue] with empty fields - Current medications opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Current medications');
  });
  test('PPCP-3 Click on [Back] - Primary Care Physician opens', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
  test('PPCP-4 Check phone field validation', async () => {
    await paperwork.checkPhoneValidations(locator.pcpNumber);
  });
  test('PPCP-5 Fill all fields and click [Continue]', async () => {
    pcpData = await paperwork.fillPrimaryCarePhysician();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Current medications');
  });
  test('PPCP-6 Click on [Back] - fields have correct values', async () => {
    await locator.clickBackButton();
    await expect(locator.pcpFirstName).toHaveValue(pcpData.firstName);
    await expect(locator.pcpLastName).toHaveValue(pcpData.lastName);
    await expect(locator.pcpAddress).toHaveValue(pcpData.pcpAddress);
    await expect(locator.pcpPractice).toHaveValue(pcpData.pcpName);
    await expect(locator.pcpNumber).toHaveValue(pcpData.formattedPhoneNumber);
  });
});
test.describe('Current medications', () => {
  test.describe.configure({ mode: 'serial' });
  test('PCM-1 Current medications - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/current-medications`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Current medications');
  });
  test('PCM-2 Current medications - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select option"', 'Current medications', false);
  });
  test('PCM-3 Current medications - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PCM-4 Current medications - Select "Patient takes medication", then select "Patient does not take medications" and click [Continue]', async () => {
    await locator.currentMedicationsPresent.click();
    await locator.currentMedicationsAbsent.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Current allergies');
  });
  test('PCM-5 Current medications - Go back from next page, "Patient does not take medications" is selected', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Current medications');
    await paperworkTelemed.checkEmptyCurrentMedications();
  });
  test('PCM-6 Current medications - Fill and check filled medications', async () => {
    medications = await paperworkTelemed.fillAndCheckFilledCurrentMedications();
  });
  test('PCM-7 Current medications - Check filled medications after reload', async () => {
    await page.reload();
    await paperworkTelemed.checkFilledCurrentMedications([medications.filledValue, medications.selectedValue]);
  });
  test('PCM-8 Current medications - Delete medications', async () => {
    await locator.deleteButton.nth(0).click();
    await locator.deleteButton.click();
    await paperworkTelemed.checkEnteredDataIsRemoved([medications.filledValue, medications.selectedValue]);
  });
  test('PCM-9 Current medications - Click [Continue] after removing medications', async () => {
    await locator.clickContinueButton();
    await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
  });
});
test.describe('Current allergies', () => {
  test.describe.configure({ mode: 'serial' });
  test('PCA-1 Current allergies - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/allergies`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Current allergies');
  });
  test('PCA-2 Current allergies - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select option"', 'Current allergies', false);
  });
  test('PCA-3 Current allergies - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PCA-4 Current allergies - Select "Patient has known current allergies", then select "Patient has no known current allergies" and click [Continue]', async () => {
    await locator.knownAllergiesPresent.click();
    await locator.knownAllergiesAbsent.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Medical history');
  });
  test('PCA-5 Current allergies - Go back from next page, "Patient has no known current allergies" is selected', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Current allergies');
    await paperworkTelemed.checkEmptyCurrentAllergies();
  });
  test('PCA-6 Current allergies - Fill and check filled allergies', async () => {
    allergies = await paperworkTelemed.fillAndCheckFilledCurrentAllergies();
  });
  test('PCA-7 Current allergies - Check filled allergies after reload', async () => {
    await page.reload();
    await paperworkTelemed.checkFilledCurrentAllergies([allergies.filledValue, allergies.selectedValue]);
  });
  test('PCA-8 Current allergies - Delete allergies', async () => {
    await locator.deleteButton.nth(0).click();
    await locator.deleteButton.click();
    await paperworkTelemed.checkEnteredDataIsRemoved([allergies.filledValue, allergies.selectedValue]);
  });
  // TODO: Need to remove skip when https://github.com/masslight/ottehr/issues/1650 is fixed
  test.skip('PCA-9 Current allergies - Click [Continue] after removing allergies', async () => {
    await locator.clickContinueButton();
    await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
  });
});
test.describe('Medical history', () => {
  test.describe.configure({ mode: 'serial' });
  test('PMH-1 Medical history - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/medical-history`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Medical history');
  });
  test('PMH-2 Medical history - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select option"', 'Medical history', false);
  });
  test('PMH-3 Medical history - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PMH-4 Medical history - Select "Patient has current medical conditions", then select "Patient has no current medical conditions" and click [Continue]', async () => {
    await locator.medicalConditionsPresent.click();
    await locator.medicalConditionsAbsent.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Surgical history');
  });
  test('PMH-5 Medical history - Go back from next page, "Patient has no current medical conditions" is selected', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Medical history');
    await paperworkTelemed.checkEmptyMedicalHistory();
  });
  test('PMH-6 Medical history - Fill and check filled medical history', async () => {
    medHistory = await paperworkTelemed.fillAndCheckFilledMedicalHistory();
  });
  test('PMH-7 Medical history - Check filled medical history after reload', async () => {
    await page.reload();
    await paperworkTelemed.checkFilledMedicalHistory([medHistory.filledValue, medHistory.selectedValue]);
  });
  test('PMH-8 Medical history - Delete medical history', async () => {
    await locator.deleteButton.nth(0).click();
    await locator.deleteButton.click();
    await paperworkTelemed.checkEnteredDataIsRemoved([medHistory.filledValue, medHistory.selectedValue]);
  });
  test('PMH-9 Medical history - Click [Continue] after removing medical history', async () => {
    await locator.clickContinueButton();
    await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
  });
});
test.describe('Surgical history', () => {
  test.describe.configure({ mode: 'serial' });
  test('PSH-1 Surgical history - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/surgical-history`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Surgical history');
  });
  test('PSH-2 Surgical history - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select option"', 'Surgical history', false);
  });
  test('PSH-3 Surgical history - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PSH-4 Surgical history - Select "Patient has surgical history", then select "Patient has no surgical history" and click [Continue]', async () => {
    await locator.surgicalHistoryPresent.click();
    await locator.surgicalHistoryAbsent.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Additional questions');
  });
  test('PSH-5 Surgical history - Go back from next page, "Patient has no surgical history" is selected', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Surgical history');
    await paperworkTelemed.checkEmptySurgicalHistory();
  });
  test('PSH-6 Surgical history - Fill and check filled surgical history', async () => {
    surgicalHistory = await paperworkTelemed.fillAndCheckFilledSurgicalHistory();
  });
  test('PSH-7 Surgical history - Check filled surgical history after reload', async () => {
    await page.reload();
    await paperworkTelemed.checkFilledSurgicalHistory([surgicalHistory.filledValue, surgicalHistory.selectedValue]);
  });
  test('PSH-8 Surgical history - Delete surgical history', async () => {
    await locator.deleteButton.nth(0).click();
    await locator.deleteButton.click();
    await paperworkTelemed.checkEnteredDataIsRemoved([surgicalHistory.filledValue, surgicalHistory.selectedValue]);
  });
  test('PSH-9 Surgical history - Click [Continue] after removing surgical history', async () => {
    await locator.clickContinueButton();
    await expect(locator.paperworkErrorInFieldAboveMessage).toBeVisible();
  });
});
test.describe('Additional questions', () => {
  test.describe.configure({ mode: 'serial' });
  test('PAQ-1 Additional questions - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/additional`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Additional questions');
  });
  test('PAQ-2 Click on [Continue] with empty fields - How would you like to pay for your visit? opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PAQ-3 Click on [Back] - Additional questions opens', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Additional questions');
  });
  test('PAQ-4 Additional questions - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PAQ-5 Additional questions - Fill and check filled additional questions', async () => {
    additionalQuestions = await paperworkTelemed.fillAndCheckAdditionalQuestions();
  });
  test('PAQ-6 Additional questions - Check filled additional questions after reload', async () => {
    await page.reload();
    await paperworkTelemed.checkAdditionalQuestions(additionalQuestions);
  });
});
test.describe('Payment option - Check Self pay and insurance options', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPO-1 Payment option - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/payment-option`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PPO-2 Payment option - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select payment option"', 'How would you like to pay for your visit?', false);
  });
  test('PPO-3 Payment option - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPO-4 Payment option - Select self pay and click [Continue]', async () => {
    await paperwork.selectSelfPayPayment();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
  });
  test('PPO-5 Payment option - Go back from next page, payment option opens', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PPO-6 Payment option - Select insurance, click [Continue], select self pay and click [Continue]', async () => {
    await paperwork.selectInsurancePayment();
    await locator.clickContinueButton();
    await paperwork.selectSelfPayPayment();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
  });
});
test.describe('Primary Insurance', () => {
  test.describe.configure({ mode: 'serial' });
  test('Primary Insurance - Check insurance details opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/payment-option`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await paperwork.selectInsurancePayment();
    await expect(locator.insuranceHeading).toBeVisible();
  });
  test('Primary Insurance - Check required fields', async () => {
    await paperwork.checkRequiredFields(
      '"Insurance carrier","Member ID","Policy holder\'s first name","Policy holder\'s last name","Policy holder\'s date of birth","Policy holder\'s birth sex","Policy holder address","City","State","ZIP","Patient\'s relationship to insured"',
      'How would you like to pay for your visit?',
      true
    );
  });
  test('Primary Insurance Select future dob - check validation error', async () => {
    await locator.policyHolderDOB.click();
    await locator.calendarArrowRight.click();
    await locator.calendarDay.click();
    await locator.calendarButtonOK.click();
    await expect(locator.dateFutureError).toBeVisible();
  });
  test('Primary Insurance - check zip validation', async () => {
    await paperwork.checkZipValidations(locator.policyHolderZip);
  });
  test('Primary Insurance - check Policy holder address is the same', async () => {
    await paperwork.checkZipValidations(locator.policyHolderZip);
  });
  test('Primary Insurance - Fill all fields without cards and click [Continue]', async () => {
    insuranceData = await paperwork.fillInsuranceAllFieldsWithoutCards();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
  });
  test('Primary Insurance - Go back and check that data is present]', async () => {
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
  test('Primary Insurance - Upload and Clear Insurance cards', async () => {
    const uploadedFrontPhoto = await uploadDocs.fillInsuranceFront();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadDocs.fillInsuranceBack();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('Primary Insurance - Upload images, reload page, check images are saved', async () => {
    await uploadDocs.fillInsuranceFront();
    await uploadDocs.fillInsuranceBack();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
  });
  test('Primary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
  });
  test('Primary Insurance - Add secondary insurance with empty fields, remove secondary insurance, continue with primary insurance', async () => {
    await locator.addSecondaryInsurance.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await locator.removeSecondaryInsurance.click();
    await expect(locator.secondaryInsuranceHeading).not.toBeVisible();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
  });
  test('Primary Insurance - Policy holder address is the same checkbox', async () => {
    await locator.clickBackButton();
    await paperwork.checkPolicyAddressIsTheSameCheckbox(false);
  });
});
test.describe('Secondary Insurance', () => {
  test.describe.configure({ mode: 'serial' });
  test('Secondary Insurance - Fill primary and Add secondary insurance', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/payment-option`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await paperwork.selectInsurancePayment();
    insuranceData = await paperwork.fillInsuranceAllFieldsWithoutCards();
    await locator.addSecondaryInsurance.click();
    await expect(locator.secondaryInsuranceHeading).toBeVisible();
  });
  // Commented due to issue https://github.com/masslight/ottehr/issues/1485.  Need to uncomment when issue is fixed.
  // test('Secondary Insurance Select future dob - check validation error', async () => {
  //   await locator.secondaryPolicyHolderDOB.click();
  //   await locator.calendarArrowRight.click();
  //   await locator.calendarDay.click();
  //   await locator.calendarButtonOK.click();
  //   await expect(locator.dateFutureError).toBeVisible();
  // });
  // test('Secondary Insurance - check zip validation', async () => {
  //   await paperwork.checkZipValidations(locator.secondaryPolicyHolderZip);
  // });
  test('Secondary Insurance - Fill all fields without cards and click [Continue]', async () => {
    secondaryInsuranceData = await paperwork.fillSecondaryInsuranceAllFieldsWithoutCards();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
  });
  test('Secondary Insurance - Go back and check that data is present]', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await expect(locator.secondaryInsuranceCarrier).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.insuranceCarrier
    );
    await expect(locator.secondaryInsuranceMemberID).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.insuranceMember
    );
    await expect(locator.secondaryPolicyHolderDOB).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.paperworkDOB
    );
    await expect(locator.secondaryPolicyHolderFirstName).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.firstName
    );
    await expect(locator.secondaryPolicyHolderLastName).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.lastName
    );
    await expect(locator.secondaryPolicyHolderAddress).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.policyHolderAddress
    );
    await expect(locator.secondaryPolicyHolderCity).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.policyHolderCity
    );
    await expect(locator.secondaryPolicyHolderState).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.policyHolderState
    );
    await expect(locator.secondaryPolicyHolderZip).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.policyHolderZip
    );
    await expect(locator.secondaryPolicyHolderBirthSex).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.birthSex
    );
    await expect(locator.secondaryPatientRelationship).toHaveValue(
      secondaryInsuranceData.insuranceRequiredData.relationship
    );
    await expect(locator.secondaryPolicyHolderMiddleName).toHaveValue(
      secondaryInsuranceData.insuranceOptionalData.policyHolderMiddleName
    );
    await expect(locator.secondaryPolicyHolderAddressLine2).toHaveValue(
      secondaryInsuranceData.insuranceOptionalData.policyHolderAddressLine2
    );
  });
  test('Secondary Insurance - Upload and Clear Insurance cards', async () => {
    const uploadedFrontPhoto = await uploadDocs.fillSecondaryInsuranceFront();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadDocs.fillSecondaryInsuranceBack();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('Secondary Insurance - Upload images, reload page, check images are saved', async () => {
    await uploadDocs.fillSecondaryInsuranceFront();
    await uploadDocs.fillSecondaryInsuranceBack();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
  });
  test('Secondary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
  });
  test('Secondary Insurance - Policy holder address is the same checkbox', async () => {
    await paperwork.checkPolicyAddressIsTheSameCheckbox(true);
  });
});
test.describe('Responsible party information - check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRPI-0 Open Responsible party information', async () => {
    await openResponsiblePartyPage();
  });
  test('PRPI-1 Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PRPI-2 Check required fields', async () => {
    await paperwork.checkRequiredFields(
      '"Relationship to the patient","First name","Last name","Date of birth","Birth sex"',
      'Responsible party information',
      true
    );
  });
  test('PRPI-3 Check phone field validation', async () => {
    await paperwork.checkPhoneValidations(locator.responsiblePartyNumber);
  });
  test('PRPI-4 Select self - check fields are prefilled with correct values', async () => {
    const dob = await commonLocatorsHelper.getMonthDay(
      bookingData.patientBasicInfo.dob.m,
      bookingData.patientBasicInfo.dob.d
    );
    if (!dob) {
      throw new Error('DOB data is null');
    }
    await paperwork.fillResponsiblePartyDataSelf();
    await expect(locator.responsiblePartyFirstName).toHaveValue(bookingData.patientBasicInfo.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(bookingData.patientBasicInfo.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(bookingData.patientBasicInfo.birthSex);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
      `${dob?.monthNumber}/${dob?.dayNumber}/${bookingData.patientBasicInfo.dob.y}`
    );
  });
  test('PRPI-5 Select self - check fields are disabled', async () => {
    await expect(locator.responsiblePartyFirstName.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyLastName.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyBirthSex.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyDOBAnswer.getAttribute('disabled')).not.toBeNull();
  });
  test('PRPI-6 Select not self - check fields are empty', async () => {
    await paperwork.fillResponsiblePartyNotSelfRelationship();
    await expect(locator.responsiblePartyFirstName).toHaveValue('');
    await expect(locator.responsiblePartyLastName).toHaveValue('');
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue('');
  });
  test('PRPI-7 Select future dob - check validation error', async () => {
    await locator.responsiblePartyDOBAnswer.click();
    await locator.calendarArrowRight.click();
    await locator.calendarDay.click();
    await locator.calendarButtonOK.click();
    await locator.clickContinueButton();
    await expect(locator.dateFutureError).toBeVisible();
  });
  test('PRPI-8 Fill all fields and click [Continue]', async () => {
    await openResponsiblePartyPage();
    responsiblePartyData = await paperwork.fillResponsiblePartyDataNotSelf();
    await expect(locator.dateOlder18YearsError).not.toBeVisible();
    await expect(locator.dateFutureError).not.toBeVisible();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Photo ID');
  });
  test('PRPI-9 Click on [Back] - all values are saved', async () => {
    await locator.clickBackButton();
    await expect(locator.responsiblePartyFirstName).toHaveValue(responsiblePartyData.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(responsiblePartyData.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(responsiblePartyData.birthSex);
    await expect(locator.responsiblePartyRelationship).toHaveValue(responsiblePartyData.relationship);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(responsiblePartyData.dob);
  });

  async function openResponsiblePartyPage(): Promise<void> {
    await page.goto(`paperwork/${bookingData.bookingUUID}/responsible-party`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Responsible party information');
  }
});
test.describe('Photo ID - Upload photo', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPID-1 Open Photo ID', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/photo-id`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Photo ID');
  });
  test('PPID-2 Photo ID - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPID-3 Upload and Clear images', async () => {
    const uploadedFrontPhoto = await uploadDocs.fillPhotoFrontID();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadDocs.fillPhotoBackID();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('PPID-5 Upload images, reload page, check images are saved', async () => {
    await uploadDocs.fillPhotoFrontID();
    await uploadDocs.fillPhotoBackID();
    await page.reload();
    await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
    await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
  });
  test('PPID-6 Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Patient condition');
    await locator.clickBackButton();
    await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
    await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
  });
});
test.describe('Patient condition', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPC-1 Open Patient condition', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/patient-condition`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Patient condition');
  });
  test('PPC-2 Patient condition - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PPC-3 Upload and Clear image', async () => {
    const uploadedPhoto = await uploadDocs.fillPatientConditionPhotoPaperwork();
    await locator.clearImage.click();
    await expect(uploadedPhoto).toBeHidden();
  });
  test('PPC-4 Upload image, reload page, check image is saved', async () => {
    await uploadDocs.fillPatientConditionPhotoPaperwork();
    await page.reload();
    await paperwork.checkImagesIsSaved(locator.photoPatientCondition);
  });
  test('PPC-5 Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
    await locator.clickBackButton();
    await paperwork.checkImagesIsSaved(locator.photoPatientCondition);
  });
});
test.describe('School/work notes', () => {
  test.describe.configure({ mode: 'serial' });
  let uploadedSchoolTemplate: UploadedFile | null = null;
  let uploadedWorkTemplate: UploadedFile | null = null;
  test('PSWN-1 Open School/work note', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/school-work-note`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
  });
  test('PSWN-2 School/work note - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PSWN-3 Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select option:"', 'Do you need a school or work note?', false);
  });
  test('PSWN-4 Select Neither option, templates block is hidden', async () => {
    await locator.neitherNotes.click();
    await expect(locator.templatesBlock).not.toBeVisible();
  });
  test('PSWN-5 Select School Only, Upload school template block is visible', async () => {
    await locator.schoolOnlyNotes.click();
    await expect(locator.templatesBlock).toBeVisible();
    await expect(locator.schoolTemplateLabel).toBeVisible();
    await expect(locator.uploadSchoolTemplate).toBeVisible();
    await expect(locator.workTemplateLabel).not.toBeVisible();
    await expect(locator.uploadWorkTemplate).not.toBeVisible();
  });
  test('PSWN-6 Select Work Only, Upload work template block is visible', async () => {
    await locator.workOnlyNotes.click();
    await expect(locator.templatesBlock).toBeVisible();
    await expect(locator.schoolTemplateLabel).not.toBeVisible();
    await expect(locator.uploadSchoolTemplate).not.toBeVisible();
    await expect(locator.workTemplateLabel).toBeVisible();
    await expect(locator.uploadWorkTemplate).toBeVisible();
  });
  test('PSWN-7 Select school and work notes, Upload school and work template blocks are visible', async () => {
    await locator.schoolAndWorkNotes.click();
    await expect(locator.templatesBlock).toBeVisible();
    await expect(locator.schoolTemplateLabel).toBeVisible();
    await expect(locator.uploadSchoolTemplate).toBeVisible();
    await expect(locator.workTemplateLabel).toBeVisible();
    await expect(locator.uploadWorkTemplate).toBeVisible();
  });
  test('PSWN-8 Select School Only, open next page, click on [Back] - check School only is selected', async () => {
    await locator.schoolOnlyNotes.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await expect(locator.schoolOnlyNotes).toBeChecked();
  });
  test('PSWN-9 Select Work Only, open next page, click on [Back] - check Work only is selected', async () => {
    await locator.workOnlyNotes.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await expect(locator.workOnlyNotes).toBeChecked();
  });
  test('PSWN-10 Select both school and work notes, open next page, click on [Back] - check School and work option is selected', async () => {
    await locator.schoolAndWorkNotes.click();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await expect(locator.schoolAndWorkNotes).toBeChecked();
  });
  test('PSWN-11 Upload and remove school template', async () => {
    uploadedSchoolTemplate = await uploadDocs.uploadFile(locator.uploadSchoolTemplate, locator.schoolNoteFile);
    await expect(uploadedSchoolTemplate.uploadedFile).toBeVisible();
    await locator.removeFile.click();
    await expect(uploadedSchoolTemplate.uploadedFile).toBeHidden();
  });
  test('PSWN-12 Upload and remove work template', async () => {
    uploadedWorkTemplate = await uploadDocs.uploadFile(locator.uploadWorkTemplate, locator.workNoteFile);
    await expect(uploadedWorkTemplate.uploadedFile).toBeVisible();
    await locator.removeFile.click();
    await expect(uploadedWorkTemplate.uploadedFile).toBeHidden();
  });
  test('PSWN-13 Check school note link value', async () => {
    uploadedSchoolTemplate = await uploadDocs.uploadFile(locator.uploadSchoolTemplate, locator.schoolNoteFile);
    const currentLink = await locator.schoolNoteFile.getAttribute('href');
    await expect(uploadedSchoolTemplate.link).toBe(currentLink);
  });
  test('PSWN-14 Check work note link value', async () => {
    uploadedWorkTemplate = await uploadDocs.uploadFile(locator.uploadWorkTemplate, locator.workNoteFile);
    const currentLink = await locator.workNoteFile.getAttribute('href');
    await expect(uploadedWorkTemplate.link).toBe(currentLink);
  });
  test('PSWN-15 Check work note link opens pdf', async () => {
    await commonLocatorsHelper.checkLinkOpensPdf(locator.workNoteFile);
  });
  test('PSWN-16 Check school note link opens pdf', async () => {
    await commonLocatorsHelper.checkLinkOpensPdf(locator.schoolNoteFile);
  });
  test('PSWN-17 Open next page, click [Back] - check templates are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await expect(uploadedSchoolTemplate!.uploadedFile).toBeVisible();
    await expect(uploadedWorkTemplate!.uploadedFile).toBeVisible();
  });
  // Need to remove skip for PSWN-18,PSWN-19, PSWN-20, when https://github.com/masslight/ottehr/issues/1671 is fixed
  test.skip('PSWN-18 Open next page, click [Back] - check school/work link values are correct', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    const currentSchoolLink = await locator.schoolNoteFile.getAttribute('href');
    await expect(uploadedSchoolTemplate!.link).toBe(currentSchoolLink);
    const currentWorkLink = await locator.workNoteFile.getAttribute('href');
    await expect(uploadedWorkTemplate!.link).toBe(currentWorkLink);
  });
  test.skip('PSWN-19 Check school note link value after reload', async () => {
    await page.reload();
    const currentLink = await locator.schoolNoteFile.getAttribute('href');
    await expect(uploadedSchoolTemplate!.link).toBe(currentLink);
  });
  test.skip('PSWN-20 Check work note link value after reload', async () => {
    await page.reload();
    const currentLink = await locator.workNoteFile.getAttribute('href');
    await expect(uploadedWorkTemplate!.link).toBe(currentLink);
  });
});
test.describe('Consent forms - Check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PCF-1 Open Consent forms', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/consent-forms`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Complete consent forms');
  });
  test('PCF-2 Consent Forms - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PCF-3 Consent Forms - Check required fields', async () => {
    await paperwork.checkRequiredFields(
      '"I have reviewed and accept HIPAA Acknowledgement","I have reviewed and accept Consent to Treat, Guarantee of Payment & Card on File Agreement","Signature","Full name","Relationship to the patient"',
      'Complete consent forms',
      true
    );
  });
  test('PCF-4 Consent Forms - Check links are correct', async () => {
    expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'href')).toBe('/hipaa_notice_template.pdf');
    expect(
      await page.getAttribute('a:has-text("Consent to Treat, Guarantee of Payment & Card on File Agreement")', 'href')
    ).toBe('/consent_to_treat_template.pdf');
  });
  test('PCF-5 Consent Forms - Check links opens in new tab', async () => {
    expect(await page.getAttribute('a:has-text("HIPAA Acknowledgement")', 'target')).toBe('_blank');
    expect(
      await page.getAttribute('a:has-text("Consent to Treat, Guarantee of Payment & Card on File Agreement")', 'target')
    ).toBe('_blank');
  });
  test('PCF-7 Consent Forms - Fill all data and click on [Continue]', async () => {
    consentFormsData = await paperwork.fillConsentForms();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
  });
  test('PCF-8 Consent Forms - Check that values are saved after coming back', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await expect(locator.hipaaAcknowledgement).toBeChecked();
    await expect(locator.consentToTreat).toBeChecked();
    await expect(locator.signature).toHaveValue(consentFormsData.signature);
    await expect(locator.consentFullName).toHaveValue(consentFormsData.consentFullName);
    await expect(locator.consentSignerRelationship).toHaveValue(consentFormsData.relationshipConsentForms);
  });
});
test.describe('Invite participant', () => {
  test.describe.configure({ mode: 'serial' });
  test('PIP-1 Open invite screen', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/invite-participant`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
  });
  test('PIP-2 Invite participant - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(
      bookingData.patientBasicInfo.firstName,
      bookingData.patientBasicInfo.lastName
    );
  });
  test('PIP-3 Invite participant - Check required fields', async () => {
    await paperwork.checkRequiredFields(
      '"Is anyone joining this visit from another device?"',
      'Would you like someone to join this call?',
      false
    );
  });
  test('PIP-4 Invite participant - Select "No" and click Continue', async () => {
    await paperworkTelemed.fillAndCheckNoInviteParticipant();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
  });
  test('PIP-5 Invite participant - Select "Yes" and check required fields', async () => {
    await locator.inviteParticipantYes.click();
    await paperwork.checkRequiredFields(
      '"First name","Last name","Preferable contact"',
      'Would you like someone to join this call?',
      true
    );
  });
  test('PIP-6 Invite participant - Select "Yes" and "Email", check required fields', async () => {
    await locator.inviteeContactEmail.click();
    await paperwork.checkRequiredFields(
      '"First name","Last name","Email address"',
      'Would you like someone to join this call?',
      true
    );
  });
  test('PIP-7 Invite participant - Select "Yes" and "Phone", check required fields', async () => {
    await locator.inviteeContactPhone.click();
    await paperwork.checkRequiredFields(
      '"First name","Last name","Phone number"',
      'Would you like someone to join this call?',
      true
    );
  });
  test('PIP-8 Invite participant - Check phone validations', async () => {
    await paperwork.checkPhoneValidations(locator.inviteePhone);
  });
  test('PIP-9 Invite participant - Check email validations', async () => {
    await paperwork.checkEmailValidations(locator.inviteeEmail);
  });
  test('PIP-10 Invite participant by phone', async () => {
    inviteeData = await paperworkTelemed.fillInviteParticipant('phone', 'paperwork');
  });
  test('PIP-11 Invite participant by phone - data is saved after reload', async () => {
    await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
    await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
    await expect(locator.inviteePhone).toHaveValue(inviteeData.phone!);
    await expect(locator.inviteeContactPhone).toBeChecked();
  });
  test('PIP-12 Invite participant by phone - data is saved after coming back', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
    await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
    await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
    await expect(locator.inviteePhone).toHaveValue(inviteeData.phone!);
    await expect(locator.inviteeContactPhone).toBeChecked();
  });
  test('PIP-13 Invite participant by email', async () => {
    inviteeData = await paperworkTelemed.fillInviteParticipant('email', 'paperwork');
  });
  test('PIP-14 Invite participant by email - data is saved after reload', async () => {
    await expect(locator.inviteeFirstName).toHaveValue(inviteeData.inviteeName.inviteeFirstName);
    await expect(locator.inviteeLastName).toHaveValue(inviteeData.inviteeName.inviteeLastName);
    await expect(locator.inviteeEmail).toHaveValue(inviteeData.email!);
    await expect(locator.inviteeContactEmail).toBeChecked();
  });
  test('PIP-15 Invite participant by email - data is saved after coming back', async () => {
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
