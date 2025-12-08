import { expect, Page, test } from '@playwright/test';
import { Appointment } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { addProcessIdMetaTagToAppointment } from 'test-utils';
import { CancelPage } from 'tests/utils/CancelPage';
import { BaseInPersonFlow } from 'tests/utils/in-person/BaseInPersonFlow';
import { ResourceHandler } from 'tests/utils/resource-handler';
import { StartVisitResponse } from 'tests/utils/telemed/BaseTelemedFlow';
import {
  BOOKING_CONFIG,
  chooseJson,
  CreateAppointmentResponse,
  GetSlotDetailsResponse,
  shouldShowServiceCategorySelectionPage,
} from 'utils';
import { FillingInfo as InPersonFillingInfo } from '../../utils/in-person/FillingInfo';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { FillingInfo as TelemedFillingInfo } from '../../utils/telemed/FillingInfo';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { TelemedVisitFlow } from '../../utils/telemed/TelemedVisitFlow';
import {
  InPersonPatientNotSelfTestData,
  InPersonPatientSelfTestData,
  InPersonPatientTestData,
  ReservationModificationPatient,
  TelemedPatientTestData,
  TelemedPrebookPatientTestData,
  TelemedWalkInPatientTestData,
} from './types';

const appointmentIds: string[] = [];
const processId = process.env.PLAYWRIGHT_SUITE_ID;
if (!processId) {
  throw new Error('Global setup has failed us.');
}

function addAppointmentToIdsAndAddMetaTag(page: Page, processId: string): void {
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      if (!appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
      const oystehr = await ResourceHandler.getOystehr();
      const appointment = await oystehr.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: appointmentId,
      });
      await oystehr.fhir.update(addProcessIdMetaTagToAppointment(appointment, processId));
    }
  });
}

function updateSlotDetailsCurrentRef(
  page: Page,
  slotDetailsRef: {
    current: GetSlotDetailsResponse;
  }
): void {
  page.on('response', async (response) => {
    if (response.url().includes('/get-slot-details/')) {
      slotDetailsRef.current = chooseJson(await response.json()) as GetSlotDetailsResponse;
    }
  });
}

function writeTestData(filename: string, data: unknown): void {
  const testDataPath = 'test-data';
  if (!fs.existsSync(testDataPath)) {
    fs.mkdirSync(testDataPath, { recursive: true });
  }
  fs.writeFileSync(path.join(testDataPath, filename), JSON.stringify(data, null, 2));
}

async function bookSecondInPersonAppointment(
  bookingData: Awaited<ReturnType<BaseInPersonFlow['startVisit']>>,
  playwrightContext: {
    page: Page;
    flowClass: PrebookInPersonFlow;
    paperwork: Paperwork;
    locator: Locators;
    fillingInfo: InPersonFillingInfo;
  }
): Promise<{
  slot: string | undefined;
  location: string | null;
}> {
  const { page, flowClass, paperwork, locator, fillingInfo } = playwrightContext;
  await page.waitForTimeout(1_000);
  await page.goto('/home');
  await locator.scheduleInPersonVisitButton.click();
  const { selectedSlot, location } = await flowClass.additionalStepsForPrebook();
  await page
    .getByRole('heading', { name: new RegExp(`.*${bookingData.firstName} ${bookingData.lastName}.*`, 'i') })
    .click({ timeout: 40_000, noWaitAfter: true, force: true });
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

async function bookSecondTelemedAppointment(
  bookingData: StartVisitResponse,
  playwrightContext: {
    page: Page;
    flowClass: PrebookTelemedFlow | TelemedVisitFlow;
    paperwork: Paperwork;
    locator: Locators;
    fillingInfo: TelemedFillingInfo;
    flow: 'prebook' | 'walk-in';
  }
): Promise<void> {
  const { page, flow, flowClass, paperwork, locator, fillingInfo } = playwrightContext;
  await page.waitForTimeout(1_000);
  await page.goto('/home');
  if (flow === 'prebook') {
    await locator.scheduleVirtualVisitButton.click();
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'prebook' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await page.getByText(firstCategory.display).click();
      }
    }
    await paperwork.checkCorrectPageOpens('Book a visit');
  } else {
    await locator.startVirtualVisitButton.click();
  }
  await flowClass.selectTimeLocationAndContinue();
  await page
    .getByRole('heading', {
      name: new RegExp(`.*${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}.*`, 'i'),
    })
    .click({ timeout: 40_000, noWaitAfter: true, force: true });
  await locator.continueButton.click();
  await fillingInfo.fillCorrectDOB(
    bookingData.patientBasicInfo.dob.m,
    bookingData.patientBasicInfo.dob.d,
    bookingData.patientBasicInfo.dob.y
  );
  await locator.continueButton.click();
  await paperwork.checkCorrectPageOpens('About the patient');
  await fillingInfo.fillTelemedReasonForVisit();
  await locator.continueButton.click();
  await paperwork.checkCorrectPageOpens('Review and submit');
  if (flow === 'prebook') {
    await locator.reserveButton.click();
    await paperwork.checkCorrectPageOpens('Thank you for choosing Ottehr!');
  } else {
    await locator.confirmWalkInButton.click();
    await paperwork.checkCorrectPageOpens('Contact information');
  }
}

test.describe.parallel('In-Person: Create test patients and appointments', () => {
  test('Create patient with self-pay and card payment appointment', async ({ page }) => {
    const slotDetailsRef: { current: GetSlotDetailsResponse } = { current: {} as GetSlotDetailsResponse };

    const { flowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      updateSlotDetailsCurrentRef(page, slotDetailsRef);
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      const locator = new Locators(page);
      const fillingInfo = new InPersonFillingInfo(page);
      return { flowClass, paperwork, locator, fillingInfo };
    });

    const { bookingData, stateValue } = await test.step('Book first appointment', async () => {
      const bookingData = await flowClass.startVisit();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      const { stateValue } = await paperwork.fillPaperworkOnlyRequiredFieldsInPerson();
      await locator.continueButton.click();
      await expect(locator.flowHeading).toHaveText('Thank you for choosing Ottehr!');
      return { bookingData, stateValue };
    });

    await test.step('Cancel first appointment', async () => {
      const cancelPage = new CancelPage(page);
      await cancelPage.clickCancelButton();
      await cancelPage.selectCancellationReason('in-person');
    });

    const { slot, location } = await test.step('Book second appointment without filling paperwork', async () => {
      return await bookSecondInPersonAppointment(bookingData, {
        page,
        flowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Save test data', async () => {
      const cardPaymentSelfPatient: InPersonPatientSelfTestData = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        slot,
        location,
        state: stateValue,
        slotDetails: slotDetailsRef.current,
        cancelledSlotDetails: {
          appointmentId: appointmentIds[appointmentIds.length - 2],
          ...(bookingData.slotDetails as GetSlotDetailsResponse),
        },
      };
      console.log('cardPaymentSelfPatient', JSON.stringify(cardPaymentSelfPatient));
      writeTestData('cardPaymentSelfPatient.json', cardPaymentSelfPatient);
    });
  });

  test('Create patient without self-pay with insurance payment appointment', async ({ page }) => {
    const slotDetailsRef: { current: GetSlotDetailsResponse } = { current: {} as GetSlotDetailsResponse };

    const { flowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      updateSlotDetailsCurrentRef(page, slotDetailsRef);
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      const locator = new Locators(page);
      const fillingInfo = new InPersonFillingInfo(page);
      return { flowClass, paperwork, locator, fillingInfo };
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
      await locator.continueButton.click();
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
      return await bookSecondInPersonAppointment(bookingData, {
        page,
        flowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Save test data', async () => {
      const insurancePaymentNotSelfPatient: InPersonPatientNotSelfTestData = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        slot,
        location,
        slotDetails: slotDetailsRef.current,
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

  test('Create patient without filling in paperwork', async ({ page }) => {
    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
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
      const patientWithoutPaperwork: InPersonPatientTestData = {
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

  test('Create patient without filling in paperwork for reservation modification', async ({ page }) => {
    const slotDetailsRef: { current: GetSlotDetailsResponse } = { current: {} as GetSlotDetailsResponse };
    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
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
      const reservationModificationPatient: ReservationModificationPatient = {
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        birthSex: bookingData.birthSex,
        dateOfBirth: bookingData.dateOfBirth,
        appointmentId: bookingData.bookingUUID,
        slotDetails: slotDetailsRef.current,
      };
      console.log('reservationModificationPatient', JSON.stringify(reservationModificationPatient));
      writeTestData('reservationModificationPatient.json', reservationModificationPatient);
    });
  });
});

test.describe.parallel('Telemed: Create test patients and appointments', () => {
  test('Create patient without self-pay with insurance payment prebook appointment', async ({ page }) => {
    const { prebookFlowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const prebookFlowClass = new PrebookTelemedFlow(page);
      const paperwork = new Paperwork(page);
      const locator = new Locators(page);
      const fillingInfo = new TelemedFillingInfo(page);
      return { prebookFlowClass, paperwork, locator, fillingInfo };
    });

    const { bookingData, filledPaperwork } = await test.step('Book first appointment', async () => {
      const bookingData = await prebookFlowClass.startVisitFullFlow();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      const filledPaperwork = await paperwork.fillPaperworkAllFieldsTelemed('insurance', 'not-self');
      await locator.finishButton.click();
      return { bookingData, filledPaperwork };
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await bookSecondTelemedAppointment(bookingData, {
        page,
        flow: 'prebook',
        flowClass: prebookFlowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Write test data to file', async () => {
      const prebookTelemedPatient: TelemedPrebookPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        state: filledPaperwork.stateValue,
        patientDetailsData: filledPaperwork.patientDetailsData,
        pcpData: filledPaperwork.pcpData,
        insuranceData: filledPaperwork.insuranceData,
        secondaryInsuranceData: filledPaperwork.secondaryInsuranceData,
        responsiblePartyData: filledPaperwork.responsiblePartyData,
        medicationData: filledPaperwork.medicationData,
        allergiesData: filledPaperwork.allergiesData,
        medicalHistoryData: filledPaperwork.medicalHistoryData,
        surgicalHistoryData: filledPaperwork.surgicalHistoryData,
        flags: filledPaperwork.flags,
        uploadedPhotoCondition: filledPaperwork.uploadedPhotoCondition,
      };
      console.log('prebookTelemedPatient', JSON.stringify(prebookTelemedPatient));
      writeTestData('prebookTelemedPatient.json', prebookTelemedPatient);
    });
  });

  test('Create patient with self-pay and card payment walk-in appointment', async ({ page }) => {
    const { walkInFlowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const walkInFlowClass = new TelemedVisitFlow(page);
      const paperwork = new Paperwork(page);
      const locator = new Locators(page);
      const fillingInfo = new TelemedFillingInfo(page);
      return { walkInFlowClass, paperwork, locator, fillingInfo };
    });

    const bookingData = await test.step('Book first appointment', async () => {
      // this uses the card payment and responsible party is self flow
      const bookingData = await walkInFlowClass.startVisitFullFlow();
      const cancelPage = new CancelPage(page);
      await cancelPage.clickCancelButton();
      await cancelPage.selectCancellationReason('virtual');
      return bookingData;
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await bookSecondTelemedAppointment(bookingData, {
        page,
        flow: 'walk-in',
        flowClass: walkInFlowClass,
        paperwork,
        locator,
        fillingInfo,
      });
    });

    await test.step('Write test data to file', async () => {
      const walkInTelemedPatient: TelemedWalkInPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        state: bookingData.stateValue,
        location: bookingData.slotAndLocation.locationTitle,
      };
      console.log('walkInTelemedPatient', JSON.stringify(walkInTelemedPatient));
      writeTestData('walkInTelemedPatient.json', walkInTelemedPatient);
    });
  });

  test('Create walk-in patient to check patient validation and for waiting room tests', async ({ page }) => {
    const walkInFlowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new TelemedVisitFlow(page);
    });

    const bookingData = await test.step('Book appointment and check flow', async () => {
      return await walkInFlowClass.startVisitFullFlow(true);
    });

    await test.step('Write test data to file', async () => {
      const waitingRoomPatient: TelemedWalkInPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: appointmentIds[appointmentIds.length - 1],
        state: bookingData.stateValue,
        location: bookingData.slotAndLocation.locationTitle,
      };
      console.log('waitingRoomPatient', JSON.stringify(waitingRoomPatient));
      writeTestData('waitingRoomPatient.json', waitingRoomPatient);
    });
  });

  test('Create patient without filling in paperwork', async ({ page }) => {
    const { prebookFlowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const prebookFlowClass = new PrebookTelemedFlow(page);
      const paperwork = new Paperwork(page);
      return { prebookFlowClass, paperwork };
    });

    const { bookingData } = await test.step('Create patient', async () => {
      const bookingData = await prebookFlowClass.startVisitFullFlow();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      return { bookingData };
    });

    await test.step('Save test data', async () => {
      const telemedPatientWithoutPaperwork: TelemedPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: bookingData.bookingUUID,
      };
      console.log('telemedPatientWithoutPaperwork', JSON.stringify(telemedPatientWithoutPaperwork));
      writeTestData('telemedPatientWithoutPaperwork.json', telemedPatientWithoutPaperwork);
    });
  });
});
