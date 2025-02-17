import { BrowserContext, Page, expect, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { StartInPersonFlow } from '../../utils/in-person/StartInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: StartInPersonFlow;
let locator: Locators;
let bookingURL: Awaited<ReturnType<StartInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
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
  flowClass = new StartInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingURL = await flowClass.startVisit();
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

test.describe.serial('Start now In person visit - Paperwork submission flow with only required fields', () => {
  test('SNPRF-1 Fill required contact information', async () => {
    await page.goto(bookingURL.bookingURL);
    await paperwork.clickProceedToPaperwork();
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
    await expect(locator.flowHeading).toHaveText('Responsible party information');
  });
  test('SNPRF-4 Fill responsible party details', async () => {
    await paperwork.fillResponsiblePartyDataSelf();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Photo ID');
  });
  test('SNPRF-5 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Review and submit');
  });
  test('SNPRF-6 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.checkInHeading).toBeVisible();
  });
});
