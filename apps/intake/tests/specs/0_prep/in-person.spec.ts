import { BrowserContext, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let paperwork: Paperwork;
let locator: Locators;
let fillingInfo: FillingInfo;
const appointmentIds: string[] = [];

test.beforeAll(
  'setup patient with in-person with card/self-pay and insurance/not-self appointments',
  async ({ browser }) => {
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
    fillingInfo = new FillingInfo(page);
  }
);

function writeTestData(filename: string, data: unknown): void {
  const testDataPath = 'test-data';
  if (!fs.existsSync(testDataPath)) {
    fs.mkdirSync(testDataPath, { recursive: true });
  }
  fs.writeFileSync(path.join(testDataPath, filename), JSON.stringify(data, null, 2));
}

async function bookAppointmentForExistingPatient(bookingData: {
  firstName: string;
  lastName: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
}): Promise<{
  slot: string | undefined;
  location: string | null;
}> {
  await page.goto('/home');
  await locator.scheduleInPersonVisitButton.click();
  const { selectedSlot, location } = await flowClass.additionalStepsForPrebook();
  await page
    .getByRole('heading', { name: new RegExp(`.*${bookingData.firstName} ${bookingData.lastName}.*`, 'i') })
    .click();
  await locator.continueButton.click();
  await fillingInfo.fillCorrectDOB(bookingData.dobMonth, bookingData.dobDay, bookingData.dobYear);
  await locator.continueButton.click();
  await fillingInfo.fillVisitReason();
  await locator.continueButton.click();
  await locator.reserveButton.click();
  await paperwork.clickProceedToPaperwork();
  return {
    slot: selectedSlot.selectedSlot,
    location,
  };
}

test.describe.parallel('In-Person Setup: Create test patients and appointments', () => {
  test('Create patient with self-pay and card payment appointment', async ({ page }) => {
    const bookingData = await flowClass.startVisit();
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    const { stateValue } = await paperwork.fillPaperworkAllFieldsInPerson('card', 'self');
    await locator.finishButton.click();

    const { slot, location } = await bookAppointmentForExistingPatient(bookingData);

    const cardPaymentSelfPatient = {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      dobMonth: bookingData.dobMonth,
      dobDay: bookingData.dobDay,
      dobYear: bookingData.dobYear,
      appointmentId: appointmentIds[appointmentIds.length - 1],
      slot,
      state: stateValue,
      location,
    };

    writeTestData('cardPaymentSelfPatient.json', cardPaymentSelfPatient);

    console.log('cardPaymentSelfPatient', JSON.stringify(cardPaymentSelfPatient));
    console.log('Appointment IDs:', appointmentIds);
  });

  test('Create patient without self-pay with insurance payment appointment', async ({ page }) => {
    const bookingData = await flowClass.startVisit();
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.fillPaperworkAllFieldsInPerson('insurance', 'not-self');
    await locator.finishButton.click();

    const { slot, location } = await bookAppointmentForExistingPatient(bookingData);

    const insurancePaymentNotSelfPatient = {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      dobMonth: bookingData.dobMonth,
      dobDay: bookingData.dobDay,
      dobYear: bookingData.dobYear,
      appointmentId: appointmentIds[appointmentIds.length - 1],
      slot,
      location,
    };

    writeTestData('insurancePaymentNotSelfPatient.json', insurancePaymentNotSelfPatient);

    console.log('insurancePaymentNotSelfPatient', JSON.stringify(insurancePaymentNotSelfPatient));
  });

  test('Create patient without filling in paperwork', async () => {
    const bookingData = await flowClass.startVisit();
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();

    const patientWithoutPaperwork = {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      dobMonth: bookingData.dobMonth,
      dobDay: bookingData.dobDay,
      dobYear: bookingData.dobYear,
      appointmentId: bookingData.bookingUUID,
    };

    writeTestData('patientWithoutPaperwork.json', patientWithoutPaperwork);

    console.log('patientWithoutPaperwork', JSON.stringify(patientWithoutPaperwork));
  });

  test('Create patient without appointments', async () => {
    const bookingData = await flowClass.startVisit();

    const patientWithoutAppointments = {
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      birthSex: bookingData.birthSex,
      dobMonth: bookingData.dobMonth,
      dobDay: bookingData.dobDay,
      dobYear: bookingData.dobYear,
    };

    writeTestData('patientWithoutAppointments.json', patientWithoutAppointments);

    console.log('patientWithoutAppointments', JSON.stringify(patientWithoutAppointments));
  });
});
