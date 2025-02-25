import { BrowserContext, Page, expect, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { Locators } from '../../utils/locators';
import { ModifyPage } from '../../utils/ModifyPage';
import { CancelPage } from '../../utils/CancelPage';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';

let context: BrowserContext;
let page: Page;
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

let bookingURL: string | undefined;

test('Schedule in person visit', async () => {
  const locators = new Locators(page);
  const prebookInPersonFlow = new PrebookInPersonFlow(page);
  await prebookInPersonFlow.goToReviewPage();
  await page.waitForLoadState();
  await locators.clickReserveButton();
  await page.waitForURL(/\/visit/);
  await expect(locators.thankYouHeading).toBeVisible({ timeout: 30000 });
  await expect(locators.proceedToPaperwork).toBeVisible({ timeout: 30000 });
  bookingURL = page.url();
});

test('MV-1 Click on [Modify] - Modify screen opens', async () => {
  const modifyPage = new ModifyPage(page);
  await modifyPage.checkModifyPageOpens();
});
test('MV-2 Update time slot', async () => {
  const modifyPage = new ModifyPage(page);
  await modifyPage.selectNewTimeSlot();
  await modifyPage.checkTimeSlotIsUpdated();
});
test('CV-1 Click on [Cancel] - Cancel screen opens', async () => {
  const cancelPage = new CancelPage(page);
  await page.goto(bookingURL || '/');
  await cancelPage.checkCancelPageOpens();
});
test('CV-2 Select cancellation reason', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.selectCancellationReason();
});
test('CV-3 Visit is canceled', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.checkVisitIsCanceled();
});
test('CV-4 Click on [Book again] - Home page opens', async () => {
  const cancelPage = new CancelPage(page);
  await cancelPage.checkBookAgainOpensHomePage();
});
