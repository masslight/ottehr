import { Page, test } from '@playwright/test';
import { Appointment } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { addProcessIdMetaTagToAppointment } from 'test-utils';
import { ResourceHandler } from 'tests/utils/resource-handler';
import { chooseJson, CreateAppointmentResponse, GetSlotDetailsResponse } from 'utils';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Paperwork, PatientDetailsData, PrimaryCarePhysicianData } from '../../utils/Paperwork';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { WalkInTelemedFlow } from '../../utils/telemed/WalkInTelemedFlow';
import {
  InPersonPatientNotSelfTestData,
  InPersonPatientSelfTestData,
  InPersonPatientTestData,
  ReservationModificationPatient,
  TelemedPatientTestData,
  TelemedPrebookPatientTestData,
  TelemedWalkInPatientTestData,
} from './types';

// Track if ANY setup test failed - used to decide whether to write success marker
let setupHasFailures = false;

// After each test, check if it failed
// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed' && testInfo.status !== 'skipped') {
    setupHasFailures = true;
  }
});

// After all tests, write marker ONLY if all tests passed
test.afterAll(async () => {
  const markerPath = path.join('test-data', '.setup-complete');
  if (!setupHasFailures) {
    const testDataPath = 'test-data';
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, { recursive: true });
    }
    fs.writeFileSync(markerPath, JSON.stringify({ completedAt: new Date().toISOString() }));
    console.log('✓ All setup tests passed. Marker file written.');
  } else {
    // Remove marker if it exists from previous run
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
    }
    console.log('✗ Setup has failures. Marker file NOT written.');
  }
});

// Per-page appointment tracking to avoid race conditions in parallel tests
const appointmentIdsByPage = new Map<Page, string[]>();

const processId = process.env.PLAYWRIGHT_SUITE_ID;
if (!processId) {
  throw new Error('Global setup has failed us.');
}

function addAppointmentToIdsAndAddMetaTag(page: Page, processId: string): void {
  // Initialize per-page array
  if (!appointmentIdsByPage.has(page)) {
    appointmentIdsByPage.set(page, []);
  }

  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      const pageIds = appointmentIdsByPage.get(page)!;
      if (!pageIds.includes(appointmentId)) {
        pageIds.push(appointmentId);
      }
      const resourceHandler = new ResourceHandler();
      await resourceHandler.initApi();
      const oystehr = resourceHandler.apiClient;
      const appointment = await oystehr.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: appointmentId,
      });
      await oystehr.fhir.update(addProcessIdMetaTagToAppointment(appointment, processId));
    }
  });
}

function getLastAppointmentId(page: Page): string {
  const pageIds = appointmentIdsByPage.get(page);
  if (!pageIds || pageIds.length === 0) {
    throw new Error('No appointment IDs captured for this page');
  }
  return pageIds[pageIds.length - 1];
}

function getSecondToLastAppointmentId(page: Page): string {
  const pageIds = appointmentIdsByPage.get(page);
  if (!pageIds || pageIds.length < 2) {
    throw new Error('Not enough appointment IDs captured for this page');
  }
  return pageIds[pageIds.length - 2];
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

test.describe.parallel('In-Person: Create test patients and appointments', () => {
  test('Create prebook patient without responsible party, with card payment, filling only required fields', async ({
    page,
  }) => {
    const slotDetailsRef: { current: GetSlotDetailsResponse } = { current: {} as GetSlotDetailsResponse };

    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      updateSlotDetailsCurrentRef(page, slotDetailsRef);
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      return { flowClass, paperwork };
    });

    const { bookingData, filledPaperwork } = await test.step('Book and cancel first appointment', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      await paperwork.clickProceedToPaperwork();
      const filledPaperwork = await flowClass.fillPaperwork({
        payment: 'card',
        responsibleParty: 'self',
        requiredOnly: true,
      });
      await flowClass.completeBooking();
      await flowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    const { selectedSlot, location } =
      await test.step('Book second appointment without filling paperwork', async () => {
        await flowClass.selectVisitAndContinue();
        const newBookingData = await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
        await paperwork.clickProceedToPaperwork();
        return newBookingData.slotAndLocation!;
      });

    await test.step('Save test data', async () => {
      const cardPaymentSelfPatient: InPersonPatientSelfTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: getLastAppointmentId(page),
        slot: selectedSlot,
        location: location!,
        state: filledPaperwork.stateValue,
        slotDetails: slotDetailsRef.current,
        cancelledSlotDetails: {
          appointmentId: getSecondToLastAppointmentId(page),
          ...(bookingData.slotDetails as GetSlotDetailsResponse),
        },
      };
      console.log('cardPaymentSelfPatient', JSON.stringify(cardPaymentSelfPatient));
      writeTestData('cardPaymentSelfPatient.json', cardPaymentSelfPatient);
    });
  });

  test('Create prebook patient with responsible party, with insurance payment, filling all fields', async ({
    page,
  }) => {
    const slotDetailsRef: { current: GetSlotDetailsResponse } = { current: {} as GetSlotDetailsResponse };

    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      updateSlotDetailsCurrentRef(page, slotDetailsRef);
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      return { flowClass, paperwork };
    });

    const { bookingData, filledPaperwork } = await test.step('Book first appointment', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      await paperwork.clickProceedToPaperwork();
      const filledPaperwork = await flowClass.fillPaperwork({
        payment: 'insurance',
        responsibleParty: 'not-self',
        requiredOnly: false,
      });
      await flowClass.completeBooking();
      await flowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    const { selectedSlot, location } =
      await test.step('Book second appointment without filling paperwork', async () => {
        await flowClass.selectVisitAndContinue();
        const newBookingData = await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
        await paperwork.clickProceedToPaperwork();
        return newBookingData.slotAndLocation!;
      });

    await test.step('Save test data', async () => {
      const insurancePaymentNotSelfPatient: InPersonPatientNotSelfTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: getLastAppointmentId(page),
        slot: selectedSlot,
        location: location!,
        slotDetails: slotDetailsRef.current,
        state: filledPaperwork.stateValue,
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsData,
        pcpData: filledPaperwork.pcpData!,
        insuranceData: filledPaperwork.insuranceData,
        secondaryInsuranceData: filledPaperwork.secondaryInsuranceData,
        responsiblePartyData: filledPaperwork.responsiblePartyData,
      };
      console.log('insurancePaymentNotSelfPatient', JSON.stringify(insurancePaymentNotSelfPatient));
      writeTestData('insurancePaymentNotSelfPatient.json', insurancePaymentNotSelfPatient);
    });
  });

  test('Create prebook patient without filling in paperwork', async ({ page }) => {
    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const flowClass = new PrebookInPersonFlow(page);
      const paperwork = new Paperwork(page);
      return { flowClass, paperwork };
    });

    const bookingData = await test.step('Create patient', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      await paperwork.clickProceedToPaperwork();
      return bookingData;
    });

    await test.step('Save test data', async () => {
      const patientWithoutPaperwork: InPersonPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
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

    const bookingData = await test.step('Create patient', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      await paperwork.clickProceedToPaperwork();
      return bookingData;
    });

    await test.step('Save test data', async () => {
      const reservationModificationPatient: ReservationModificationPatient = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: bookingData.bookingUUID,
        slotDetails: slotDetailsRef.current,
      };
      console.log('reservationModificationPatient', JSON.stringify(reservationModificationPatient));
      writeTestData('reservationModificationPatient.json', reservationModificationPatient);
    });
  });
});

test.describe.parallel('Telemed: Create test patients and appointments', () => {
  test('Create prebook patient with responsible party, with insurance payment, filling all fields', async ({
    page,
  }) => {
    const { prebookFlowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const prebookFlowClass = new PrebookTelemedFlow(page);
      const paperwork = new Paperwork(page);
      return { prebookFlowClass, paperwork };
    });

    const { bookingData, filledPaperwork } = await test.step('Book first appointment', async () => {
      await prebookFlowClass.selectVisitAndContinue();
      const bookingData = await prebookFlowClass.startVisitWithoutPaperwork();
      await paperwork.clickProceedToPaperwork();
      const filledPaperwork = await prebookFlowClass.fillPaperwork({
        payment: 'insurance',
        responsibleParty: 'not-self',
        patientBasicInfo: bookingData.patientBasicInfo,
      });
      await prebookFlowClass.completeBooking();
      await prebookFlowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await prebookFlowClass.selectVisitAndContinue();
      await prebookFlowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
    });

    await test.step('Write test data to file', async () => {
      const prebookTelemedPatient: TelemedPrebookPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: getLastAppointmentId(page),
        state: filledPaperwork.stateValue,
        // todo because i'm not great at type conditional types apparently
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsData,
        // todo because i'm not great at type conditional types apparently
        pcpData: filledPaperwork.pcpData as PrimaryCarePhysicianData,
        insuranceData: filledPaperwork.insuranceData,
        secondaryInsuranceData: filledPaperwork.secondaryInsuranceData,
        responsiblePartyData: filledPaperwork.responsiblePartyData,
        medicationData: filledPaperwork.medicationData,
        allergiesData: filledPaperwork.allergiesData,
        medicalHistoryData: filledPaperwork.medicalHistoryData,
        surgicalHistoryData: filledPaperwork.surgicalHistoryData,
        flags: filledPaperwork.flags!,
        uploadedPhotoCondition: filledPaperwork.uploadedPhotoCondition!,
      };
      console.log('prebookTelemedPatient', JSON.stringify(prebookTelemedPatient));
      writeTestData('prebookTelemedPatient.json', prebookTelemedPatient);
    });
  });

  test('Create walk-in patient without responsible party, with card payment, filling only required fields', async ({
    page,
  }) => {
    const walkInFlowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const { bookingData, filledPaperwork } = await test.step('Book first appointment', async () => {
      await walkInFlowClass.selectVisitAndContinue();
      const bookingData = await walkInFlowClass.startVisitWithoutPaperwork();
      const filledPaperwork = await walkInFlowClass.fillPaperwork({
        payment: 'card',
        responsibleParty: 'self',
        requiredOnly: true,
      });
      await walkInFlowClass.completeBooking();
      await walkInFlowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await walkInFlowClass.clickVisitButton();
      await walkInFlowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
    });

    await test.step('Write test data to file', async () => {
      const walkInTelemedPatient: TelemedWalkInPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: getLastAppointmentId(page),
        state: filledPaperwork.stateValue,
        location: bookingData.slotAndLocation.locationTitle,
      };
      console.log('walkInTelemedPatient', JSON.stringify(walkInTelemedPatient));
      writeTestData('walkInTelemedPatient.json', walkInTelemedPatient);
    });
  });

  test('Create walk-in patient to check patient validation and for waiting room tests', async ({ page }) => {
    const walkInFlowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const { bookingData, filledPaperwork } = await test.step('Book appointment and check flow', async () => {
      await walkInFlowClass.selectVisitAndContinue();
      const bookingData = await walkInFlowClass.startVisitWithoutPaperwork();
      const filledPaperwork = await walkInFlowClass.fillPaperwork({
        // this is the fastest way to go through paperwork. changing these shouldn't break the test.
        payment: 'card',
        responsibleParty: 'self',
        requiredOnly: true,
      });
      await walkInFlowClass.completeBooking();
      return { bookingData, filledPaperwork };
    });

    await test.step('Write test data to file', async () => {
      const waitingRoomPatient: TelemedWalkInPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: getLastAppointmentId(page),
        state: filledPaperwork.stateValue,
        location: bookingData.slotAndLocation.locationTitle,
      };
      console.log('waitingRoomPatient', JSON.stringify(waitingRoomPatient));
      writeTestData('waitingRoomPatient.json', waitingRoomPatient);
    });
  });

  test('Create patient without filling in paperwork', async ({ page }) => {
    const walkInFlowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const bookingData = await test.step('Create patient', async () => {
      return await walkInFlowClass.startVisitWithoutPaperwork();
    });

    await test.step('Save test data', async () => {
      const telemedPatientWithoutPaperwork: TelemedPatientTestData = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dob: bookingData.patientBasicInfo.dob,
        appointmentId: bookingData.bookingUUID,
      };
      console.log('telemedPatientWithoutPaperwork', JSON.stringify(telemedPatientWithoutPaperwork));
      writeTestData('telemedPatientWithoutPaperwork.json', telemedPatientWithoutPaperwork);
    });
  });
});
