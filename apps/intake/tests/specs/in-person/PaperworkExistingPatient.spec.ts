// cSpell:ignore IPPP, networkidle
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork, PATIENT_ADDRESS, PATIENT_ADDRESS_LINE_2, PATIENT_CITY, PATIENT_ZIP } from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let filledPaperwork: Awaited<ReturnType<Paperwork['fillPaperworkAllFieldsInPerson']>>;
let fillingInfo: FillingInfo;
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
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  fillingInfo = new FillingInfo(page);
  bookingData = await flowClass.startVisit();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Check paperwork is prefilled for existing patient. Payment - insurance, responsible party - not self', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    filledPaperwork = await paperwork.fillPaperworkAllFieldsInPerson('insurance', 'not-self');
    await locator.finishButton.click();
    await page.goto('/home');
    await locator.scheduleInPersonVisitButton.click();
    await flowClass.additionalStepsForPrebook();
    await paperwork.checkCorrectPageOpens('Welcome Back!');
    await page
      .getByRole('heading', { name: new RegExp(`.*${bookingData.firstName} ${bookingData.lastName}.*`, 'i') })
      .click();
    await locator.continueButton.click();
    await fillingInfo.fillCorrectDOB(bookingData.dobMonth, bookingData.dobDay, bookingData.dobYear);
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('About the patient');
    await fillingInfo.fillVisitReason();
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.reserveButton.click();
    await paperwork.checkCorrectPageOpens('Thank you for choosing Ottehr!');
  });
  test('IPPP-1 Check Contact information has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/contact-information`);
    await expect(locator.patientState).toHaveValue(filledPaperwork.stateValue);
    await expect(locator.patientZip).toHaveValue(PATIENT_ZIP);
    await expect(locator.patientCity).toHaveValue(PATIENT_CITY);
    await expect(locator.streetAddress).toHaveValue(PATIENT_ADDRESS);
    await expect(locator.streetAddressLine2).toHaveValue(PATIENT_ADDRESS_LINE_2);
    await paperwork.checkEmailIsPrefilled(bookingData.email);
    await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
    await expect(locator.mobileOptIn).toBeChecked();
  });
  test('IPPP-2 Check Patient details has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/patient-details`);
    await expect(locator.patientEthnicity).toHaveValue(filledPaperwork.patientDetailsData.randomEthnicity);
    await expect(locator.patientRace).toHaveValue(filledPaperwork.patientDetailsData.randomRace);
    await expect(locator.patientPronouns).toHaveValue(filledPaperwork.patientDetailsData.randomPronoun);
    await expect(locator.patientPointOfDiscovery).toBeHidden();
    await expect(locator.patientPreferredLanguage).toHaveValue(filledPaperwork.patientDetailsData.randomLanguage);
  });
  test('IPPP-3 Check Primary Care Physician has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/primary-care-physician`);
    await expect(locator.pcpFirstName).toHaveValue(filledPaperwork.pcpData.firstName);
    await expect(locator.pcpLastName).toHaveValue(filledPaperwork.pcpData.lastName);
    await expect(locator.pcpAddress).toHaveValue(filledPaperwork.pcpData.pcpAddress);
    await expect(locator.pcpNumber).toHaveValue(filledPaperwork.pcpData.formattedPhoneNumber);
    await expect(locator.pcpPractice).toHaveValue(filledPaperwork.pcpData.pcpName);
  });
  // TODO: Need to remove skip when https://github.com/masslight/ottehr/issues/1988 is fixed
  test.skip('IPPP-4 Check Payment has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/payment-option`);
    await expect(locator.insuranceOption).toBeChecked();
  });
  test('IPPP-5 Check Primary insurance has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/payment-option`);
    await locator.insuranceOption.click();
    await expect(locator.insuranceHeading).toBeVisible();
    await test.step('Primary Insurance cards are prefilled', async () => {
      await paperwork.checkImagesIsSaved(locator.insuranceFrontImage);
      await paperwork.checkImagesIsSaved(locator.insuranceBackImage);
    });
    await test.step('Primary Insurance data is prefilled', async () => {
      await expect(locator.insuranceCarrier).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.insuranceCarrier
      );
      await expect(locator.insuranceMemberID).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.insuranceMember
      );
      await expect(locator.policyHolderDOB).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.paperworkDOB
      );
      await expect(locator.policyHolderFirstName).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.firstName
      );
      await expect(locator.policyHolderLastName).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.lastName
      );
      await expect(locator.policyHolderMiddleName).toHaveValue(
        filledPaperwork.insuranceData!.insuranceOptionalData.policyHolderMiddleName
      );
      await expect(locator.patientRelationship).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.relationship
      );
      await expect(locator.policyHolderBirthSex).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.birthSex
      );

      await expect(locator.policyHolderAddress).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.policyHolderAddress
      );
      await expect(locator.policyHolderCity).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.policyHolderCity
      );
      await expect(locator.policyHolderState).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.policyHolderState
      );
      await expect(locator.policyHolderZip).toHaveValue(
        filledPaperwork.insuranceData!.insuranceRequiredData.policyHolderZip
      );
      await expect(locator.policyHolderAddressLine2).toHaveValue(
        filledPaperwork.insuranceData!.insuranceOptionalData.policyHolderAddressLine2
      );
    });
  });
  // TODO: Need to remove skip when https://github.com/masslight/ottehr/issues/1938 is fixed
  test.skip('IPPP-6 Check Secondary insurance has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/payment-option`);
    await expect(locator.insuranceHeading).toBeVisible();
    await locator.addSecondaryInsurance.click();
    await test.step('Secondary Insurance cards are prefilled', async () => {
      await paperwork.checkImagesIsSaved(locator.secondaryInsuranceFrontImage);
      await paperwork.checkImagesIsSaved(locator.secondaryInsuranceBackImage);
    });
    await test.step('Secondary Insurance data is prefilled', async () => {
      await expect(locator.secondaryInsuranceCarrier).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.insuranceCarrier
      );
      await expect(locator.secondaryInsuranceMemberID).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.insuranceMember
      );
      await expect(locator.secondaryPolicyHolderDOB).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.paperworkDOB
      );
      await expect(locator.secondaryPolicyHolderFirstName).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.firstName
      );
      await expect(locator.secondaryPolicyHolderLastName).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.lastName
      );
      await expect(locator.secondaryPolicyHolderAddress).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.policyHolderAddress
      );
      await expect(locator.secondaryPolicyHolderCity).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.policyHolderCity
      );
      await expect(locator.secondaryPolicyHolderState).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.policyHolderState
      );
      await expect(locator.secondaryPolicyHolderZip).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.policyHolderZip
      );
      await expect(locator.secondaryPolicyHolderBirthSex).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.birthSex
      );
      await expect(locator.secondaryPatientRelationship).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceRequiredData.relationship
      );
      await expect(locator.secondaryPolicyHolderMiddleName).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceOptionalData.policyHolderMiddleName
      );
      await expect(locator.secondaryPolicyHolderAddressLine2).toHaveValue(
        filledPaperwork.secondaryInsuranceData!.insuranceOptionalData.policyHolderAddressLine2
      );
    });
  });
  test('IPPP-7 Check Responsible party has prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/responsible-party`);
    await expect(locator.responsiblePartyFirstName).toHaveValue(filledPaperwork.responsiblePartyData!.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(filledPaperwork.responsiblePartyData!.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(filledPaperwork.responsiblePartyData!.birthSex);
    await expect(locator.responsiblePartyRelationship).toHaveValue(filledPaperwork.responsiblePartyData!.relationship);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(filledPaperwork.responsiblePartyData!.dob);
    await expect(locator.responsiblePartyCity).toHaveValue(filledPaperwork.responsiblePartyData!.city);
    await expect(locator.responsiblePartyState).toHaveValue(filledPaperwork.responsiblePartyData!.state);
    await expect(locator.responsiblePartyZip).toHaveValue(filledPaperwork.responsiblePartyData!.zip);
    await expect(locator.responsiblePartyAddress1).toHaveValue(filledPaperwork.responsiblePartyData!.address1);
    await expect(locator.responsiblePartyAddress2).toHaveValue(filledPaperwork.responsiblePartyData!.additionalAddress);
    await expect(locator.responsiblePartyNumber).toHaveValue(filledPaperwork.responsiblePartyData!.phone);
    await expect(locator.responsiblePartyEmail).toHaveValue(filledPaperwork.responsiblePartyData!.email);
  });
  test('IPPP-8 Check Photo ID has prefilled images', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/photo-id`);
    await paperwork.checkImagesIsSaved(locator.photoIdFrontImage);
    await paperwork.checkImagesIsSaved(locator.photoIdBackImage);
  });
  test('IPPP-9 Check Consent form does not have prefilled values', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/consent-forms`);
    await expect(locator.hipaaAcknowledgement).not.toBeChecked();
    await expect(locator.consentToTreat).not.toBeChecked();
    await expect(locator.signature).toHaveValue('');
    await expect(locator.consentFullName).toHaveValue('');
    await expect(locator.consentSignerRelationship).toHaveValue('');
  });
});
