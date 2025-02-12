import { BrowserContext, Page, expect, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';

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

let email: string;
let firstName: string;
let lastName: string;

test('Test filling Paperwork - In Person Visit', async ({ page }) => {
  const paperwork = new Paperwork(page);

  await test.step('Prerequisite - Schedule in person visit', async () => {
    const locators = new Locators(page);
    const prebookInPersonFlow = new PrebookInPersonFlow(page);
    const bookingData = await prebookInPersonFlow.goToReviewPage();
    email = bookingData.email;
    firstName = bookingData.firstName;
    lastName = bookingData.lastName;
    await page.waitForLoadState();
    await locators.clickReserveButton();
    await page.waitForURL(/\/visit/);
    await expect.soft(locators.thankYouHeading).toBeVisible({ timeout: 30000 });
    await expect(locators.proceedToPaperwork).toBeVisible({ timeout: 30000 });
  });

  await test.step('PCI-1 Click on [Proceed to paperwork] - Contact information screen opens', async () => {
    await paperwork.checkContactInformationPageOpens();
  });
  await test.step('PCI-2 Fill Contact Information all fields', async () => {
    await paperwork.fillContactInformationAllFields();
  });
  await test.step('PCI-3 Contact Information - Check email is prefilled', async () => {
    await paperwork.checkEmailIsPrefilled(email);
  });
  await test.step('PCI-4 Contact Information - Check mobile is prefilled', async () => {
    await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
  });
  await test.step('PCI-5 Contact Information - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(firstName, lastName);
  });
  await test.step('PPD-1 Click on [Continue] - Patient details screen opens', async () => {
    await paperwork.checkPatientDetailsPageOpens();
  });
});
