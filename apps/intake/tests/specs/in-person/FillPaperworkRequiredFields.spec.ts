import { BrowserContext, test, Page, expect } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Paperwork } from '../../utils/Paperwork';
import { Locators } from '../../utils/locators';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let locator: Locators;
let bookingURL: Awaited<ReturnType<PrebookInPersonFlow['prebookInPersonVisit']>>;
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
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingURL = await flowClass.prebookInPersonVisit();
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

test.describe('In person visit - Paperwork submission flow with only required fields', () => {
  test('PRF-1 Fill required contact information', async () => {
    await page.goto(bookingURL.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.fillContactInformationRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.patientDetailsHeading).toBeVisible();
  });

  test('PRF-2 Fill patient details', async () => {
    await paperwork.fillPatientDetailsRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.PCPHeading).toBeVisible();
  });

  test('PRF-3 Skip PCP and Select Self-Pay Payment Option', async () => {
    await paperwork.skipPrimaryCarePhysician();
    await paperwork.selectSelfPayPayment();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.responsiblePartyHeading).toBeVisible();
  });
  test('PRF-4 Fill responsible party details', async () => {
    await paperwork.fillResponsiblePartyDataSelf();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.photoIDHeading).toBeVisible();
  });
  test('PRF-5 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.titleReviewScreen).toBeVisible();
  });
  test('PRF-6 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.thankYouHeading).toBeVisible();
    await expect(locator.editPaperwork).toBeVisible();
  });
});
