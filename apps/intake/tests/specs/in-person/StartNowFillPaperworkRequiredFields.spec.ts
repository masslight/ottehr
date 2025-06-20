// cSpell:ignore SNPRF
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
// import { StartInPersonFlow } from '../../utils/in-person/StartInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { FillingInfo } from '../../utils/telemed/FillingInfo';

let page: Page;
let context: BrowserContext;
// let flowClass: StartInPersonFlow;
let locator: Locators;
// let bookingURL: Awaited<ReturnType<StartInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
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
  // flowClass = new StartInPersonFlow(page);
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
    await page.goto('/home');
    await locator.startInPersonVisitButton.click();
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
    await expect(locator.flowHeading).toHaveText('Photo ID');
  });
  test('SNPRF-6 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Review and submit');
  });
  test('SNPRF-7 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.checkInHeading).toBeVisible();
  });
});
