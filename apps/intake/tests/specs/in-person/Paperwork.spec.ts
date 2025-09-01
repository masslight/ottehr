// cSpell:ignore networkidle, PPCP, PRPI
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { UploadDocs } from '../../utils/UploadDocs';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadDocs;
let pcpData: Awaited<ReturnType<Paperwork['fillPrimaryCarePhysician']>>;
let insuranceData: Awaited<ReturnType<Paperwork['fillInsuranceAllFieldsWithoutCards']>>;
let secondaryInsuranceData: Awaited<ReturnType<Paperwork['fillSecondaryInsuranceAllFieldsWithoutCards']>>;
let responsiblePartyData: Awaited<ReturnType<Paperwork['fillResponsiblePartyDataNotSelf']>>;
let consentFormsData: Awaited<ReturnType<Paperwork['fillConsentForms']>>;
let commonLocatorsHelper: CommonLocatorsHelper;
const appointmentIds: string[] = [];

const PAGE_TITLE_AFTER_PAYMENT_OPTION = 'Credit card details';

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
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  uploadPhoto = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisit();
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
    await paperwork.checkEmailIsPrefilled(bookingData.email);
  });
  test('PCI-4 Contact Information - Check mobile is prefilled', async () => {
    await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
  });
  test('PCI-5 Contact Information - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
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
    await paperwork.checkCorrectPageOpens('Patient details');
  });
  test('PPD-1 Check required fields', async () => {
    await paperwork.checkRequiredFields('"Ethnicity","Race","Preferred language"', 'Patient details', true);
  });
  test('PPD-2 Fill Patient details all fields', async () => {
    await paperwork.fillPatientDetailsAllFields();
  });
  test('PPD-3 Patient details - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
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
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
  test('PPCP-1 Primary Care Physician - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('PPCP-2 Click on [Continue] with empty fields - Primary Care Physician opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
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
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
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
test.describe('Payment option - Check Self pay and insurance options', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPO-1 Payment option - Check page opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/payment-option`);
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PPO-2 Payment option - Check required fields', async () => {
    await paperwork.checkRequiredFields('"Select payment option"', 'How would you like to pay for your visit?', false);
  });
  test('PPO-3 Payment option - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('PPO-4 Payment option - Select self pay and click [Continue]', async () => {
    await paperwork.selectSelfPayPayment();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
  });
});
test.describe('Primary Insurance', () => {
  test.describe.configure({ mode: 'serial' });
  test('Primary Insurance - Check insurance details opens', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/payment-option`);
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
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    const uploadedFrontPhoto = await uploadPhoto.fillInsuranceFront();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadPhoto.fillInsuranceBack();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('Primary Insurance - Upload images, reload page, check images are saved', async () => {
    await uploadPhoto.fillInsuranceFront();
    await uploadPhoto.fillInsuranceBack();
    await page.reload();
    await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
  });
  test('Primary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    const uploadedFrontPhoto = await uploadPhoto.fillSecondaryInsuranceFront();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadPhoto.fillSecondaryInsuranceBack();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('Secondary Insurance - Upload images, reload page, check images are saved', async () => {
    await uploadPhoto.fillSecondaryInsuranceFront();
    await uploadPhoto.fillSecondaryInsuranceBack();
    await page.reload();
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
    await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
  });
  test('Secondary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens(PAGE_TITLE_AFTER_PAYMENT_OPTION);
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
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
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
  test('PRPI-4 Check email field validation', async () => {
    await paperwork.checkEmailValidations(locator.responsiblePartyEmail);
  });
  test('PRPI-5 Select self - check fields are prefilled with correct values', async () => {
    const dob = await commonLocatorsHelper.getMonthDay(bookingData.dobMonth, bookingData.dobDay);
    if (!dob) {
      throw new Error('DOB data is null');
    }
    await paperwork.fillResponsiblePartyDataSelf();
    await expect(locator.responsiblePartyFirstName).toHaveValue(bookingData.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(bookingData.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(bookingData.birthSex);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
      `${dob?.monthNumber}/${dob?.dayNumber}/${bookingData.dobYear}`
    );
  });
  test('PRPI-6 Select self - check fields are disabled', async () => {
    await expect(locator.responsiblePartyFirstName.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyLastName.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyBirthSex.getAttribute('disabled')).not.toBeNull();
    await expect(locator.responsiblePartyDOBAnswer.getAttribute('disabled')).not.toBeNull();
  });
  test('PRPI-7 Select not self - check fields are empty', async () => {
    await paperwork.fillResponsiblePartyNotSelfRelationship();
    await expect(locator.responsiblePartyFirstName).toHaveValue('');
    await expect(locator.responsiblePartyLastName).toHaveValue('');
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue('');
  });
  test('PRPI-8 Select future dob - check validation error', async () => {
    await locator.responsiblePartyDOBAnswer.click();
    await locator.calendarArrowRight.click();
    await locator.calendarDay.click();
    await locator.calendarButtonOK.click();
    await locator.clickContinueButton();
    await expect(locator.dateFutureError).toBeVisible();
  });
  test('PRPI-9 Fill all fields and click [Continue]', async () => {
    await openResponsiblePartyPage();
    responsiblePartyData = await paperwork.fillResponsiblePartyDataNotSelf();
    await expect(locator.dateOlder18YearsError).not.toBeVisible();
    await expect(locator.dateFutureError).not.toBeVisible();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Photo ID');
  });
  test('PRPI-10 Click on [Back] - all values are saved', async () => {
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

  async function openResponsiblePartyPage(): Promise<void> {
    await page.goto(`paperwork/${bookingData.bookingUUID}/responsible-party`);
    await paperwork.checkCorrectPageOpens('Responsible party information');
  }
});
test.describe('Photo ID - Upload photo', () => {
  test.describe.configure({ mode: 'serial' });
  test('PPID-1 Open Photo ID', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/photo-id`);
    await paperwork.checkCorrectPageOpens('Photo ID');
  });
  test('PPID-2 Photo ID - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName, true);
  });
  test('PPID-3 Upload and Clear images', async () => {
    const uploadedFrontPhoto = await uploadPhoto.fillPhotoFrontID();
    await locator.clearImage.click();
    await expect(uploadedFrontPhoto).toBeHidden();
    const uploadedBackPhoto = await uploadPhoto.fillPhotoBackID();
    await locator.clearImage.click();
    await expect(uploadedBackPhoto).toBeHidden();
  });
  test('PPID-5 Upload images, reload page, check images are saved', async () => {
    await uploadPhoto.fillPhotoFrontID();
    await uploadPhoto.fillPhotoBackID();
    await page.reload();
    await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
    await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
  });
  test('PPID-6 Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
    await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
  });
});
test.describe('Consent forms - Check and fill all fields', () => {
  test.describe.configure({ mode: 'serial' });
  test('PCF-1 Open Consent forms', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/consent-forms`);
    await paperwork.checkCorrectPageOpens('Complete consent forms');
  });
  test('PCF-2 Consent Forms - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
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
    await paperwork.checkCorrectPageOpens('Review and submit');
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
