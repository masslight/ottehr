// cSpell:ignore SNPRF
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { QuestionnaireHelper } from '../../utils/QuestionnaireHelper';
import { FillingInfo } from '../../utils/telemed/FillingInfo';

let page: Page;
let context: BrowserContext;
let locator: Locators;
let paperwork: Paperwork;
let commonLocatorsHelper: CommonLocatorsHelper;
const appointmentIds: string[] = [];
const locationName = process.env.LOCATION;
const employerInformationPageExists = QuestionnaireHelper.hasEmployerInformationPage();

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
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.serial('Start now In person visit - Paperwork submission flow with only required fields', () => {
  test('SNPRF-1 Fill required contact information', async () => {
    await page.goto(`/walkin/location/${locationName?.replaceAll(' ', '_')}`);
    await locator.clickContinueButton();
    await locator.selectDifferentFamilyMember();
    await locator.clickContinueButton();
    const fillingInfo = new FillingInfo(page);
    await fillingInfo.fillNewPatientInfo();
    await fillingInfo.fillDOBgreater18();
    await locator.clickContinueButton();
    await locator.confirmWalkInButton.click();
    await locator.proceedToPaperwork.click();
    await paperwork.fillContactInformationRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Patient details');
  });

  test('SNPRF-2 Fill patient details', async () => {
    await paperwork.fillPatientDetailsRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Primary Care Physician');
  });

  test('SNPRF-3 Skip PCP and Select Self-Pay Payment Option', async () => {
    await paperwork.skipPrimaryCarePhysician();
    await paperwork.skipPreferredPharmacy();
    await paperwork.selectSelfPayPayment();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Credit card details');
  });
  test('SNPRF-4 Skip Card selection and proceed to responsible party page', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toBeVisible();
    await expect(locator.flowHeading).toHaveText('Responsible party information');
  });
  test('SNPRF-5 Fill responsible party details', async () => {
    await paperwork.fillResponsiblePartyDataSelf();
    await commonLocatorsHelper.clickContinue();
    if (employerInformationPageExists) {
      await expect(locator.flowHeading).toHaveText('Employer information');
    } else {
      await expect(locator.flowHeading).toHaveText('Emergency Contact');
    }
  });
  if (employerInformationPageExists) {
    test('SNPRF-6 Fill employer information', async () => {
      await paperwork.fillEmployerInformation();
      await commonLocatorsHelper.clickContinue();
      await expect(locator.flowHeading).toHaveText('Emergency Contact');
    });
  }
  test('SNPRF-7 Fill emergency contact details', async () => {
    await expect(locator.flowHeading).toHaveText('Emergency Contact');
    await paperwork.fillEmergencyContactInformation();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Photo ID');
  });
  test('SNPRF-8 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Review and submit');
  });
  test('SNPRF-9 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.checkInHeading).toBeVisible();
  });
});
