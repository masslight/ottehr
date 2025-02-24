import { BrowserContext, expect, Page, test } from '@playwright/test';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { cleanAppointment } from 'test-utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { clickContinue } from '../../utils/utils';

let context: BrowserContext;
let page: Page;
let fillingInfo: FillingInfo;
let firstAvailableTime : string;
const location = 'California';

const appointmentIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  fillingInfo = new FillingInfo(page);

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
  await page.goto('/home');

  const scheduleButton = page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
  await expect(scheduleButton).toBeVisible();
  await scheduleButton.click();

  await page.waitForTimeout(2000);
  const statesSelector = page.getByTestId(dataTestIds.scheduleVirtualVisitStatesSelector);
  await expect(statesSelector).toBeVisible();

  await statesSelector.getByRole('button').click();
  await page.getByRole('option', { name: location }).click();
  const firstTimeButton = page.getByRole('button', {name: 'First available time'});
  firstAvailableTime = (await firstTimeButton.textContent()).replace('First available time: ', '');
  console.log('first time',firstAvailableTime);
  await expect(firstTimeButton).toBeVisible();
  await firstTimeButton.click();

  await page.getByTestId(dataTestIds.continueButton).click();
  await expect(page.getByRole('heading', { name: 'Different family member' })).toBeVisible();
});

test('Should select and create new patient', async () => {
  await page.getByRole('heading', { name: 'Different family member' }).click();

  await clickContinue(page);

  await expect(page.getByText('About the patient')).toBeVisible();

  await expect(page.getByPlaceholder('First name')).toBeVisible();

  await fillingInfo.fillNewPatientInfo();

  await fillingInfo.fillDOBless18();

  await clickContinue(page);
  const reserveThisCheckTimeButton = page.getByTestId(dataTestIds.continueButton);
  await expect(reserveThisCheckTimeButton).toBeVisible();
  await reserveThisCheckTimeButton.click();
  await expect(page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock)).toBeVisible({timeout: 30000});
});

test('Should check "thank you" page has correct location and visit time', async () => {
  await expect(page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock)).toHaveText(firstAvailableTime);
  await expect(page.locator('.appointment-description')).toHaveText(RegExp(location));
});