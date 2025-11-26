import { Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { chooseJson, CreateAppointmentResponse, GetSlotDetailsResponse } from 'utils';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';

const appointmentIds: string[] = [];

function writeTestData(filename: string, data: unknown): void {
  const testDataPath = 'test-data';
  if (!fs.existsSync(testDataPath)) {
    fs.mkdirSync(testDataPath, { recursive: true });
  }
  fs.writeFileSync(path.join(testDataPath, filename), JSON.stringify(data, null, 2));
}

async function bookAppointmentForExistingPatient(
  bookingData: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  },
  playwrightContext: {
    page: Page;
    flowClass: PrebookInPersonFlow;
    paperwork: Paperwork;
    locator: Locators;
    fillingInfo: FillingInfo;
  }
): Promise<{
  slot: string | undefined;
  location: string | null;
}> {
  const { page, flowClass, paperwork, locator, fillingInfo } = playwrightContext;
  await page.goto('/home');
  await locator.scheduleInPersonVisitButton.click();
  const { selectedSlot, location } = await flowClass.additionalStepsForPrebook();
  await page
    .getByRole('heading', { name: new RegExp(`.*${bookingData.firstName} ${bookingData.lastName}.*`, 'i') })
    .click();
  await locator.continueButton.click();
  const [year, month, day] = bookingData.dateOfBirth.split('-');
  await fillingInfo.fillCorrectDOB(month, day, year);
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

test.describe.parallel('In-Person: Create test patients and appointments', () => {
  test('Create patient with self-pay and card payment appointment', async ({ page }) => {
    const { slotDetails, flowClass, paperwork, locator, fillingInfo } =
      await test.step('Set up playwright', async () => {
        let slotDetails = {} as GetSlotDetailsResponse;

        page.on('response', async (response) => {
          if (response.url().includes('/create-appointment/')) {
            const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
            if (!appointmentIds.includes(appointmentId)) {
              appointmentIds.push(appointmentId);
            }
          }
        });
        page.on('response', async (response) => {
          if (response.url().includes('/get-slot-details/')) {
            slotDetails = chooseJson(await response.json()) as GetSlotDetailsResponse;
          }
        });
        const flowClass = new PrebookInPersonFlow(page);
        const paperwork = new Paperwork(page);
        const locator = new Locators(page);
        const fillingInfo = new FillingInfo(page);
        return { slotDetails, flowClass, paperwork, locator, fillingInfo };
      });

    const { bookingData, stateValue } = await test.step('Book first appointment', async () => {
      const bookingData = await flowClass.startVisit();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      const { stateValue } = await paperwork.fillPaperworkOnlyRequiredFieldsInPerson();
      await locator.continueButton.click();
      return { bookingData, stateValue };
    });

    const { slot, location } = await test.step('Book second appointment without filling paperwork', async () => {
      return await bookAppointmentForExistingPatient(bookingData, {
        page,
        flowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Save test data', async () => {
      const cardPaymentSelfPatient = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        slot,
        location,
        state: stateValue,
        slotDetails,
      };
      console.log('cardPaymentSelfPatient', JSON.stringify(cardPaymentSelfPatient));
      writeTestData('cardPaymentSelfPatient.json', cardPaymentSelfPatient);
    });
  });

  test('Create patient without self-pay with insurance payment appointment', async ({ page }) => {
    const { slotDetails, flowClass, paperwork, locator, fillingInfo } =
      await test.step('Set up playwright', async () => {
        let slotDetails = {} as GetSlotDetailsResponse;

        page.on('response', async (response) => {
          if (response.url().includes('/create-appointment/')) {
            const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
            if (!appointmentIds.includes(appointmentId)) {
              appointmentIds.push(appointmentId);
            }
          }
        });
        page.on('response', async (response) => {
          if (response.url().includes('/get-slot-details/')) {
            slotDetails = chooseJson(await response.json()) as GetSlotDetailsResponse;
          }
        });
        const flowClass = new PrebookInPersonFlow(page);
        const paperwork = new Paperwork(page);
        const locator = new Locators(page);
        const fillingInfo = new FillingInfo(page);
        return { slotDetails, flowClass, paperwork, locator, fillingInfo };
      });

    const {
      bookingData,
      stateValue,
      patientDetailsData,
      pcpData,
      insuranceData,
      secondaryInsuranceData,
      responsiblePartyData,
    } = await test.step('Book first appointment', async () => {
      const bookingData = await flowClass.startVisit();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      const { stateValue, patientDetailsData, pcpData, insuranceData, secondaryInsuranceData, responsiblePartyData } =
        await paperwork.fillPaperworkAllFieldsInPerson('insurance', 'not-self');
      await locator.finishButton.click();
      return {
        bookingData,
        stateValue,
        patientDetailsData,
        pcpData,
        insuranceData,
        secondaryInsuranceData,
        responsiblePartyData,
      };
    });

    const { slot, location } = await test.step('Book second appointment without filling paperwork', async () => {
      return await bookAppointmentForExistingPatient(bookingData, {
        page,
        flowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Save test data', async () => {
      const insurancePaymentNotSelfPatient = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        slot,
        location,
        slotDetails,
        state: stateValue,
        patientDetailsData,
        pcpData,
        insuranceData,
        secondaryInsuranceData,
        responsiblePartyData,
      };
      console.log('insurancePaymentNotSelfPatient', JSON.stringify(insurancePaymentNotSelfPatient));
      writeTestData('insurancePaymentNotSelfPatient.json', insurancePaymentNotSelfPatient);
    });
  });

  test('Create patient without filling in paperwork', async ({ browser, page }) => {
    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('response', async (response) => {
        if (response.url().includes('/create-appointment/')) {
          const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
          if (!appointmentIds.includes(appointmentId)) {
            appointmentIds.push(appointmentId);
          }
        }
      });
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      return { flowClass, paperwork };
    });

    const { bookingData } = await test.step('Create patient', async () => {
      const bookingData = await flowClass.startVisit();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      return { bookingData };
    });

    await test.step('Save test data', async () => {
      const patientWithoutPaperwork = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: bookingData.bookingUUID,
      };
      console.log('patientWithoutPaperwork', JSON.stringify(patientWithoutPaperwork));
      writeTestData('patientWithoutPaperwork.json', patientWithoutPaperwork);
    });
  });

  test('Create patient without appointments', async ({ browser }) => {
    const flowClass = await test.step('Set up playwright', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      return new PrebookInPersonFlow(page);
    });

    const { bookingData } = await test.step('Create patient', async () => {
      const bookingData = await flowClass.startVisit();
      return { bookingData };
    });

    await test.step('Save test data', async () => {
      const patientWithoutAppointments = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
      };
      console.log('patientWithoutAppointments', JSON.stringify(patientWithoutAppointments));
      writeTestData('patientWithoutAppointments.json', patientWithoutAppointments);
    });
  });
});
