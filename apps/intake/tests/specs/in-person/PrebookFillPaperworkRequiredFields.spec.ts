import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let bookingURL: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
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
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingURL = await flowClass.startVisit();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Prebook In person visit - Paperwork submission flow with only required fields', () => {
  test.describe.configure({ mode: 'serial' });

  test('PRF-1 Fill required contact information', async () => {
    await page.goto(bookingURL.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.fillContactInformationRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Patient details');
  });

  test('PRF-2 Fill patient details', async () => {
    await paperwork.fillPatientDetailsRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Primary Care Physician');
  });

  test('PRF-3 Skip PCP and Select Self-Pay Payment Option', async () => {
    await paperwork.skipPrimaryCarePhysician();
    await paperwork.selectSelfPayPayment();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toBeVisible();
    await expect(locator.flowHeading).toHaveText('Credit card details');
  });
  test('PRF-4 Skip Card selection and proceed to responsible party page', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toBeVisible();
    await expect(locator.flowHeading).toHaveText('Responsible party information');
  });
  test('PRF-5 Fill responsible party details', async () => {
    await paperwork.fillResponsiblePartyDataSelf();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Photo ID');
  });
  test('PRF-6 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Review and submit');
  });
  test('PRF-7 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toBeVisible();
    await expect(locator.flowHeading).toHaveText('Thank you for choosing Ottehr!');
  });
});
