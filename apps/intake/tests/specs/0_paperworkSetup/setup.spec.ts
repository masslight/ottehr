import { Page, test } from '@playwright/test';
import { Appointment } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { addProcessIdMetaTagToAppointment } from 'test-utils';
import { ResourceHandler } from 'tests/utils/resource-handler';
import { BOOKING_CONFIG, chooseJson, CreateAppointmentResponse, GetSlotDetailsResponse } from 'utils';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import {
  Paperwork,
  PatientDetailsData,
  PatientDetailsRequiredData,
  PrimaryCarePhysicianData,
} from '../../utils/Paperwork';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { WalkInTelemedFlow } from '../../utils/telemed/WalkInTelemedFlow';
import {
  InPersonNoPwPatient,
  InPersonNoRpNoInsReqPatient,
  InPersonReservationModificationPatient,
  InPersonRpInsNoReqPatient,
  TelemedNoPwPatient,
  TelemedNoRpNoInsReqPatient,
  TelemedRpInsNoReqPatient,
  TelemedWaitingRoomPatient,
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

// ---------------------------------------------------------------------------------------------------------------------
// Most patients created in this file have the following naming convention:
// [inPerson|telemed][[Rp|NoRp][Ins|NoIns][Req|NoReq]|NoPw]Patient.json.
//
// Other patients can be created for a specific test suite and will follow this naming convention:
// [inPerson|telemed][<unique test name>]Patient.json.
//
// This way each test suite can grab the paperwork data it needs without coupling it with the flow type used to create
// the patient. The names correspond to the arguments passed to the paperwork filling functions.
//
//   Key:
// Rp: Responsible party provided.
// NoRp: Self is chosen as responsible party.
//
// Ins: Insurance details provided, thus no credit card needed for payment.
//      NB: core ottehr requires credit card for telemed appointments regardless.
// NoIns: No insurance details provided, thus credit card needed for payment.
//
// Req: Only required fields filled in paperwork.
// NoReq: All fields filled in paperwork.
//
// NoPw: No paperwork filled in. The appointment flow gets to the first paperwork page to create a patient but doesn't
//       fill in any paperwork.
// ---------------------------------------------------------------------------------------------------------------------

test.describe.parallel('In-Person: Create test patients and appointments', { tag: '@smoke' }, () => {
  test('Create patient without responsible party, with card payment, filling only required fields', async ({
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

    const slotAndLocation = await test.step('Book second appointment without filling paperwork', async () => {
      await flowClass.selectVisitAndContinue();
      const newBookingData = await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
      await paperwork.clickProceedToPaperwork();
      return newBookingData.slotAndLocation!;
    });

    await test.step('Save test data', async () => {
      const inPersonNoRpNoInsReqPatient: InPersonNoRpNoInsReqPatient = {
        ...bookingData.patientBasicInfo,
        ...slotAndLocation,
        appointmentId: getLastAppointmentId(page),
        slotDetails: slotDetailsRef.current,
        cancelledSlotDetails: {
          appointmentId: getSecondToLastAppointmentId(page),
          ...(bookingData.slotDetails as GetSlotDetailsResponse),
        },
        state: filledPaperwork.state,
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsRequiredData,
        employerInformation: filledPaperwork.employerInformation,
        emergencyContact: filledPaperwork.emergencyContactInformation,
      };
      console.log('inPersonNoRpNoInsReqPatient', JSON.stringify(inPersonNoRpNoInsReqPatient));
      writeTestData('inPersonNoRpNoInsReqPatient.json', inPersonNoRpNoInsReqPatient);
    });
  });

  test('Create patient with responsible party, with insurance payment, filling all fields', async ({ page }) => {
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

    const slotAndLocation = await test.step('Book second appointment without filling paperwork', async () => {
      await flowClass.selectVisitAndContinue();
      const newBookingData = await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
      await paperwork.clickProceedToPaperwork();
      return newBookingData.slotAndLocation!;
    });

    await test.step('Save test data', async () => {
      const inPersonRpInsNoReqPatient: InPersonRpInsNoReqPatient = {
        ...bookingData.patientBasicInfo,
        ...slotAndLocation,
        appointmentId: getLastAppointmentId(page),
        slotDetails: slotDetailsRef.current,
        cancelledSlotDetails: {
          appointmentId: getSecondToLastAppointmentId(page),
          ...(bookingData.slotDetails as GetSlotDetailsResponse),
        },
        state: filledPaperwork.state,
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsData,
        employerInformation: filledPaperwork.employerInformation,
        emergencyContact: filledPaperwork.emergencyContactInformation,
        pcpData: filledPaperwork.pcpData!,
        insuranceData: filledPaperwork.insuranceData!,
        secondaryInsuranceData: filledPaperwork.secondaryInsuranceData!,
        responsiblePartyData: filledPaperwork.responsiblePartyData!,
      };
      console.log('inPersonRpInsNoReqPatient', JSON.stringify(inPersonRpInsNoReqPatient));
      writeTestData('inPersonRpInsNoReqPatient.json', inPersonRpInsNoReqPatient);
    });
  });

  test('Create patient without filling in paperwork', async ({ page }) => {
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
      const inPersonNoPwPatient: InPersonNoPwPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: bookingData.appointmentId,
      };
      console.log('inPersonNoPwPatient', JSON.stringify(inPersonNoPwPatient));
      writeTestData('inPersonNoPwPatient.json', inPersonNoPwPatient);
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
      const inPersonReservationModificationPatient: InPersonReservationModificationPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: bookingData.appointmentId,
        slotDetails: slotDetailsRef.current,
      };
      console.log('inPersonReservationModificationPatient', JSON.stringify(inPersonReservationModificationPatient));
      writeTestData('inPersonReservationModificationPatient.json', inPersonReservationModificationPatient);
    });
  });
});

test.describe.parallel('Telemed: Create test patients and appointments', { tag: '@smoke' }, () => {
  test('Create patient with responsible party, with insurance payment, filling all fields', async ({ page }) => {
    if (!BOOKING_CONFIG.homepageOptions.includes('schedule-virtual-visit')) {
      test.skip();
    }
    const { flowClass, paperwork } = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      const flowClass = new PrebookTelemedFlow(page);
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
        patientBasicInfo: bookingData.patientBasicInfo,
      });
      await flowClass.completeBooking();
      await flowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await flowClass.selectVisitAndContinue();
      await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
    });

    await test.step('Write test data to file', async () => {
      const telemedRpInsNoReqPatient: TelemedRpInsNoReqPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: getLastAppointmentId(page),
        location: bookingData.slotAndLocation.location,
        state: filledPaperwork.state,
        // todo because i'm not great at type conditional types apparently
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsData,
        pcpData: filledPaperwork.pcpData as PrimaryCarePhysicianData,
        insuranceData: filledPaperwork.insuranceData!,
        secondaryInsuranceData: filledPaperwork.secondaryInsuranceData!,
        responsiblePartyData: filledPaperwork.responsiblePartyData!,
        medicationData: filledPaperwork.medicationData,
        allergiesData: filledPaperwork.allergiesData,
        medicalHistoryData: filledPaperwork.medicalHistoryData,
        surgicalHistoryData: filledPaperwork.surgicalHistoryData,
        flags: filledPaperwork.flags!,
        uploadedPhotoCondition: filledPaperwork.uploadedPhotoCondition!,
      };
      console.log('telemedRpInsNoReqPatient', JSON.stringify(telemedRpInsNoReqPatient));
      writeTestData('telemedRpInsNoReqPatient.json', telemedRpInsNoReqPatient);
    });
  });

  test('Create patient without responsible party, with card payment, filling only required fields', async ({
    page,
  }) => {
    const flowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const { bookingData, filledPaperwork } = await test.step('Book first appointment', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      const filledPaperwork = await flowClass.fillPaperwork({
        payment: 'card',
        responsibleParty: 'self',
        requiredOnly: true,
      });
      await flowClass.completeBooking();
      await flowClass.cancelAppointment();
      return { bookingData, filledPaperwork };
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await flowClass.clickVisitButton();
      await flowClass.startVisitWithoutPaperwork(bookingData.patientBasicInfo);
    });

    await test.step('Write test data to file', async () => {
      const telemedNoRpNoInsReqPatient: TelemedNoRpNoInsReqPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: getLastAppointmentId(page),
        location: bookingData.slotAndLocation.location,
        state: filledPaperwork.state,
        patientDetailsData: filledPaperwork.patientDetailsData as PatientDetailsRequiredData,
      };
      console.log('telemedNoRpNoInsReqPatient', JSON.stringify(telemedNoRpNoInsReqPatient));
      writeTestData('telemedNoRpNoInsReqPatient.json', telemedNoRpNoInsReqPatient);
    });
  });

  test('Create patient to check patient validation and for waiting room tests', async ({ page }) => {
    const flowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const { bookingData, filledPaperwork } = await test.step('Book appointment and check flow', async () => {
      await flowClass.selectVisitAndContinue();
      const bookingData = await flowClass.startVisitWithoutPaperwork();
      const filledPaperwork = await flowClass.fillPaperwork({
        // this is the fastest way to go through paperwork. changing these shouldn't break the test.
        payment: 'card',
        responsibleParty: 'self',
        requiredOnly: true,
      });
      await flowClass.completeBooking();
      return { bookingData, filledPaperwork };
    });

    await test.step('Write test data to file', async () => {
      const telemedWaitingRoomPatient: TelemedWaitingRoomPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: getLastAppointmentId(page),
        location: bookingData.slotAndLocation.location,
        state: filledPaperwork.state,
      };
      console.log('telemedWaitingRoomPatient', JSON.stringify(telemedWaitingRoomPatient));
      writeTestData('telemedWaitingRoomPatient.json', telemedWaitingRoomPatient);
    });
  });

  test('Create patient without filling in paperwork', async ({ page }) => {
    const flowClass = await test.step('Set up playwright', async () => {
      addAppointmentToIdsAndAddMetaTag(page, processId);
      return new WalkInTelemedFlow(page);
    });

    const bookingData = await test.step('Create patient', async () => {
      return await flowClass.startVisitWithoutPaperwork();
    });

    await test.step('Save test data', async () => {
      const telemedNoPwPatient: TelemedNoPwPatient = {
        ...bookingData.patientBasicInfo,
        appointmentId: bookingData.appointmentId,
      };
      console.log('telemedNoPwPatient', JSON.stringify(telemedNoPwPatient));
      writeTestData('telemedNoPwPatient.json', telemedNoPwPatient);
      console.log('✓ Created telemedNoPwPatient test data.'); // delete this, just trying to trigger tests
    });
  });
});
