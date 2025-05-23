import Oystehr from '@oystehr/sdk';
import { vi, assert } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import { randomUUID } from 'crypto';
import {
  adjustHoursOfOperation,
  changeAllCapacities,
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  makeTestPatient,
  persistSchedule,
  persistTestPatient,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  createSlotParamsFromSlotAndOptions,
  getOriginalBookingUrlFromSlot,
  getScheduleExtension,
  GetScheduleResponse,
  getServiceModeFromSlot,
  getSlugForBookableResource,
  getTimezone,
  PatientInfo,
  SLUG_SYSTEM,
} from 'utils';
import { Location, Patient, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';

describe('prebook integration - from getting list of slots to booking with selected slot', () => {
  let oystehr: Oystehr;
  let token = null;
  let processId: string | null = null;
  let existingTestPatient: Patient;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API, PROJECT_ID } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    console.log('project api', PROJECT_API);

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: 'http://localhost:3000/local',
      projectId: PROJECT_ID,
    });
    existingTestPatient = await persistTestPatient({ patient: makeTestPatient(), processId }, oystehr);
  });
  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    await cleanupTestScheduleResources(processId, oystehr);
  });
  it('successfully creates an appointment after selecting an available slot', async () => {
    expect(oystehr).toBeDefined();
    expect(existingTestPatient).toBeDefined();
    assert(existingTestPatient);
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'BusySlotsTestLcocation',
      description: 'We only just met but I will be gone soon',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `busy-slots-slimy-slug-${randomUUID()}`,
        },
      ],
      address: {
        use: 'work',
        type: 'physical',
        line: ['12345 Test St'],
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
      },
      telecom: [
        {
          system: 'phone',
          use: 'work',
          value: '1234567890',
        },
        {
          system: 'url',
          use: 'work',
          value: 'https://example.com',
        },
      ],
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    expect(schedule.id).toBeDefined();
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    expect(owner).toBeDefined();
    assert(owner);
    const slug = getSlugForBookableResource(owner);
    expect(slug).toBeDefined();
    let getScheduleResponse: GetScheduleResponse | undefined;
    try {
      getScheduleResponse = (
        await oystehr.zambda.executePublic({
          id: 'get-schedule',
          slug,
          scheduleType: 'location',
        })
      ).output as GetScheduleResponse;
    } catch (e) {
      console.error('Error executing get-schedule zambda', e);
    }
    expect(getScheduleResponse).toBeDefined();
    assert(getScheduleResponse);

    const { available } = getScheduleResponse;

    const randomIndex = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const selectedSlot = available[randomIndex];
    expect(selectedSlot).toBeDefined();
    assert(selectedSlot);

    const createSlotParams = createSlotParamsFromSlotAndOptions(selectedSlot.slot, {
      walkin: false,
      originalBookingUrl: `prebook/in-person?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    console.log('createSlotParams', createSlotParams);

    let createdSlotResponse: Slot | undefined;
    try {
      createdSlotResponse = (
        await oystehr.zambda.executePublic({
          id: 'create-slot',
          ...createSlotParams,
        })
      ).output as Slot;
    } catch (e) {
      console.error('Error executing get-schedule zambda', e);
    }
    expect(createdSlotResponse).toBeDefined();
    assert(createdSlotResponse);
    expect(createdSlotResponse.id).toBeDefined();
    assert(createdSlotResponse.id);
    expect(createdSlotResponse.resourceType).toEqual('Slot');
    expect(createdSlotResponse.status).toEqual('busy-tentative');
    expect(createdSlotResponse.start).toEqual(selectedSlot.slot.start);
    expect(createdSlotResponse.end).toEqual(
      DateTime.fromISO(selectedSlot.slot.end, { zone: getTimezone(schedule) }).toISO()
    );
    const serviceMode = getServiceModeFromSlot(createdSlotResponse);
    expect(serviceMode).toEqual('in-person');
    const bookingUrl = getOriginalBookingUrlFromSlot(createdSlotResponse);
    expect(bookingUrl).toEqual(`prebook/in-person?bookingOn=${slug}`);

    const patient: PatientInfo = {
      id: existingTestPatient.id,
      firstName: existingTestPatient.name![0]!.given![0],
      lastName: existingTestPatient!.name![0]!.family,
      sex: 'female',
      dateOfBirth: existingTestPatient.birthDate,
      newPatient: false,
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: createdSlotResponse.id,
    };

    let createAppointmentResponse: CreateAppointmentResponse | undefined;
    try {
      createAppointmentResponse = (
        await oystehr.zambda.execute({
          id: 'create-appointment',
          ...createAppointmentInputParams,
        })
      ).output as CreateAppointmentResponse;
    } catch (e) {
      console.error('Error executing create-appointment zambda', e);
    }
    expect(createAppointmentResponse).toBeDefined();

    /*

      export interface CreateAppointmentInputParams {
        patient: PatientInfo;
        slotId: string;
        language?: string;
        locationState?: string;
        unconfirmedDateOfBirth?: string | undefined;
      }

      export interface PatientBaseInfo {
  firstName?: string;
  id?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
}
  export type PatientInfo = PatientBaseInfo & {
    newPatient?: boolean;
    chosenName?: string;
    sex?: Patient['gender'];
    weight?: number;
    weightLastUpdated?: string;
    email?: string;
    reasonForVisit?: string;
    reasonAdditional?: string;
    phoneNumber?: string;
    pointOfDiscovery?: boolean;
    telecom?: {
      system: string;
      value: string;
    }[];
    address?: Address[];
  };
      
    */
  });
});
