import { BrowserContext, Page, expect, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { UploadImage } from '../../utils/UploadImage';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadImage;
let pcpData: Awaited<ReturnType<Paperwork['fillPrimaryCarePhysician']>>;
let insuranceData: Awaited<ReturnType<Paperwork['fillInsuranceAllFieldsWithoutCards']>>;
let secondaryInsuranceData: Awaited<ReturnType<Paperwork['fillSecondaryInsuranceAllFieldsWithoutCards']>>;
let responsiblePartyData: Awaited<ReturnType<Paperwork['fillResponsiblePartyDataNotSelf']>>;
let commonLocatorsHelper: CommonLocatorsHelper;
const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointment } = await response.json();
      if (appointment && !appointmentIds.includes(appointment)) {
        appointmentIds.push(appointment);
      }
    }
  });
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  uploadPhoto = new UploadImage(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisit();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
  const env = process.env.ENV;
  for (const appointment of appointmentIds) {
    console.log(`Deleting ${appointment} on env: ${env}`);
    await cleanAppointment(appointment, env!);
  }
});

test.describe.configure({ mode: 'serial' });
test.describe('Contact information screen - Check and fill all fields', () => {
  test('PCI-1 Click on [Proceed to paperwork] - Contact information screen opens', async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.checkContactInformationPageOpens();
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
  test('PPD-1 Check required fields', async () => {
    await paperwork.checkRequiredFields('"Ethnicity","Race","Preferred language"', 'Patient details');
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
test.describe('Payment page - self pay option', () => {
  // TODO: Tests for payment page will be added and updated under #848 ticket
  test('Check that select payment page opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('Payment - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('Payment - Select self pay', async () => {
    await paperwork.selectSelfPayPayment();
  });
  test('Click on [Continue] - Responsible party information opens', async () => {
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
    await page.waitForLoadState('networkidle');
    await paperwork.checkImagesAreSaved(locator.insuranceFrontImage, locator.insuranceBackImage);
  });
  test('Primary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkImagesAreSaved(locator.insuranceFrontImage, locator.insuranceBackImage);
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
    await page.waitForLoadState('networkidle');
    await paperwork.checkImagesAreSaved(locator.secondaryInsuranceFrontImage, locator.secondaryInsuranceBackImage);
  });
  test('Secondary Insurance - Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkImagesAreSaved(locator.secondaryInsuranceFrontImage, locator.secondaryInsuranceBackImage);
  });
  test('Secondary Insurance - Policy holder address is the same checkbox', async () => {
    await paperwork.checkPolicyAddressIsTheSameCheckbox(true);
  });
});
test.describe('Responsible party information - check and fill all fields', () => {
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
  test('PRPI-4 Select self - check fields are prefilled with correct values', async () => {
    const dob = await commonLocatorsHelper.getMonthDay(bookingData.dobMonth, bookingData.dobDay);
    await paperwork.fillResponsiblePartyDataSelf();
    await expect(locator.responsiblePartyFirstName).toHaveValue(bookingData.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(bookingData.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(bookingData.birthSex);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
      `${dob.monthNumber}/${dob.dayNumber}/${bookingData.dobYear}`
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
    await expect(locator.responsiblePartyBirthSex).toHaveValue('');
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue('');
  });
  test('PRPI-7 Select dob less than 18 years - check validation error', async () => {
    await locator.responsiblePartyDOBAnswer.click();
    await locator.responsiblePartyCalendarCurrentDay.click();
    await locator.responsiblePartyCalendarButtonOK.click();
    await expect(locator.dateOlder18YearsError).toBeVisible();
  });
  test('PRPI-8 Select future dob - check validation error', async () => {
    await locator.responsiblePartyDOBAnswer.click();
    await locator.responsiblePartyCalendarArrowRight.click();
    await locator.responsiblePartyCalendarDay.click();
    await locator.responsiblePartyCalendarButtonOK.click();
    await expect(locator.dateFutureError).toBeVisible();
  });
  test('PRPI-9 Fill all fields and click [Continue]', async () => {
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
  });
});
test.describe('Photo ID - Upload photo', () => {
  test('PPID-1 Click on [Continue] - Photo ID page opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Photo ID');
  });
  test('PPID-2 Photo ID - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
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
    await paperwork.checkImagesAreSaved();
  });
  test('PPID-6 Open next page, click [Back] - check images are saved', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await paperwork.checkImagesAreSaved();
  });
});
