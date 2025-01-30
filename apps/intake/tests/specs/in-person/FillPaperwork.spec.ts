import { BrowserContext, Page, expect, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
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

let email: string | undefined;
let firstName: string | undefined;
let lastName: string | undefined;

test('Prerequisite - Schedule in person visit', async () => {
  const locators = new Locators(page);
  const prebookInPersonFlow = new PrebookInPersonFlow(page);
  const bookingData = await prebookInPersonFlow.goToReviewPageInPersonVisit();
  email = bookingData.email;
  firstName = bookingData.firstName;
  lastName = bookingData.lastName;
  await page.waitForLoadState();
  await locators.clickReserveButton();
  await page.waitForURL(/\/visit/);
  await expect(locators.thankYouHeading).toBeVisible({ timeout: 30000 });
  await expect(locators.proceedToPaperwork).toBeVisible({ timeout: 30000 });
});

test('PCI-1 Click on [Proceed to paperwork] - Contact information screen opens', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.checkContactInformationPageOpens();
});
test('PCI-2 Fill Contact Information all fields', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.fillContactInformationAllFields();
});
test('PCI-3 Contact Information - Check email is prefilled', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.checkEmailIsPrefilled(email || '');
});
test('PCI-4 Contact Information - Check mobile is prefilled', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
});
test('PCI-5 Contact Information - Check patient name is displayed', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.checkPatientNameIsDisplayed(firstName || '', lastName || '');
});
test('PPD-1 Click on [Continue] - Patient details screen opens', async () => {
  const paperwork = new Paperwork(page);
  await paperwork.checkPatientDetailsPageOpens();
});
