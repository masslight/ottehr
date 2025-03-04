import { BrowserContext, expect, Page, test } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { Locators } from '../../utils/locators';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';

let context: BrowserContext;
let page: Page;
let firstAvailableTime: string;
let location;
let locators: Locators;
let telemedFlow: PrebookTelemedFlow;

const appointmentIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  locators = new Locators(page);
  telemedFlow = new PrebookTelemedFlow(page);

  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointment } = await response.json();
      if (appointment && !appointmentIds.includes(appointment)) {
        console.log('Created appointment: ', appointment);
        appointmentIds.push(appointment);
      }
    }
  });
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  const env = process.env.ENV;

  for (const appointmentId of appointmentIds) {
    console.log(`Deleting ${appointmentId} on env: ${env}`);
    await cleanAppointment(appointmentId, env!);
  }
});

test('Should select state and time', async () => {
  await telemedFlow.selectVisitAndContinue();
  const slotAndLocation = await telemedFlow.selectTimeLocationAndContinue();
  firstAvailableTime = slotAndLocation.selectedSlot.fullSlot;
  location = slotAndLocation.location;
});

test('Should select and create new patient', async () => {
  await telemedFlow.selectDifferentFamilyMemberAndContinue();
  await telemedFlow.fillNewPatientDataAndContinue();
  await telemedFlow.continue(); // this one for submitting reserve page
  await expect(page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock)).toBeVisible({ timeout: 30000 });
});

test('Should check "thank you" page has correct location and visit time', async () => {
  const timeBlock = page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock);
  console.log(await timeBlock.textContent());
  await expect(timeBlock).toHaveText(firstAvailableTime);
  await expect(locators.appointmentDescription).toHaveText(RegExp(location));
});
