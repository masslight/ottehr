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
  checkEncounterIsVirtual,
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
import { Appointment, Location, Patient, Slot } from 'fhir/r4b';
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
  it('successfully creates an in person appointment for a returning patient after selecting an available slot', async () => {
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
    const timezone = getTimezone(schedule);

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
    let serviceMode = getServiceModeFromSlot(createdSlotResponse);
    expect(serviceMode).toEqual('in-person');
    let bookingUrl = getOriginalBookingUrlFromSlot(createdSlotResponse);
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
    assert(createAppointmentResponse);
    const {
      appointment: appointmentId,
      fhirPatientId,
      questionnaireResponseId,
      encounterId,
      resources,
    } = createAppointmentResponse;
    expect(appointmentId).toBeDefined();
    assert(appointmentId);
    expect(fhirPatientId).toBeDefined();
    assert(fhirPatientId);
    expect(questionnaireResponseId).toBeDefined();
    assert(questionnaireResponseId);
    expect(encounterId).toBeDefined();
    assert(encounterId);
    expect(resources).toBeDefined();
    assert(resources);

    const { appointment, encounter, questionnaire, patient: fhirPatient } = resources;
    expect(appointment).toBeDefined();
    assert(appointment);
    expect(appointment.id).toEqual(appointmentId);
    expect(appointment.status).toEqual('booked');
    assert(appointment.start);
    expect(DateTime.fromISO(appointment.start!, { zone: timezone }).toISO()).toEqual(createdSlotResponse.start);
    expect(appointment.slot?.[0]?.reference).toEqual(`Slot/${createdSlotResponse.id}`);

    expect(encounter).toBeDefined();
    assert(encounter);
    expect(encounter.id);
    expect(encounter.status).toEqual('planned');
    expect(checkEncounterIsVirtual(encounter)).toEqual(false);
    expect(questionnaire).toBeDefined();
    assert(questionnaire);
    expect(fhirPatient).toBeDefined();
    assert(fhirPatient);
    expect(fhirPatient.id).toEqual(patient.id);

    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: createdSlotResponse.id,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // reschedule the appointment and make sure everything still looks good
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

    const { available: newAvailable } = getScheduleResponse;

    const index = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const rescheduleSlot = newAvailable[index];
    expect(rescheduleSlot).toBeDefined();
    assert(rescheduleSlot);

    const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
      walkin: false,
      originalBookingUrl: `prebook/in-person?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    let rescheduleSlotResponse: Slot | undefined;
    try {
      rescheduleSlotResponse = (
        await oystehr.zambda.executePublic({
          id: 'create-slot',
          ...rescheduleSlotParams,
        })
      ).output as Slot;
    } catch (e) {
      console.error('Error executing get-schedule zambda', e);
    }
    expect(rescheduleSlotResponse).toBeDefined();
    assert(rescheduleSlotResponse);
    expect(rescheduleSlotResponse.id).toBeDefined();
    assert(rescheduleSlotResponse.id);
    expect(rescheduleSlotResponse.resourceType).toEqual('Slot');
    expect(rescheduleSlotResponse.status).toEqual('busy-tentative');
    expect(rescheduleSlotResponse.start).toEqual(rescheduleSlot.slot.start);
    expect(rescheduleSlotResponse.end).toEqual(
      DateTime.fromISO(rescheduleSlot.slot.end, { zone: getTimezone(schedule) }).toISO()
    );
    serviceMode = getServiceModeFromSlot(createdSlotResponse);
    expect(serviceMode).toEqual('in-person');
    bookingUrl = getOriginalBookingUrlFromSlot(createdSlotResponse);
    expect(bookingUrl).toEqual(`prebook/in-person?bookingOn=${slug}`);

    let rescheduleAppointmentResponse: any | undefined;
    try {
      rescheduleAppointmentResponse = (
        await oystehr.zambda.executePublic({
          id: 'update-appointment',
          appointmentID: appointment.id,
          slot: rescheduleSlotResponse,
        })
      ).output;
    } catch (e) {
      console.error('Error executing update-appointment zambda', e);
    }
    console.log('rescheduleAppointmentResponse', rescheduleAppointmentResponse);
    expect(rescheduleAppointmentResponse).toBeDefined();
    assert(rescheduleAppointmentResponse);

    const { appointmentID } = rescheduleAppointmentResponse;
    expect(appointmentID).toBeDefined();
    assert(appointmentID);
    expect(appointmentID).toEqual(appointment.id);

    const [newAppointmentSearch, oldSlotSearch] = await Promise.all([
      oystehr.fhir.search<Appointment | Slot>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentID,
          },
          {
            name: '_include',
            value: 'Appointment:slot',
          },
        ],
      }),

      oystehr.fhir.search<Slot>({
        resourceType: 'Slot',
        params: [
          {
            name: '_id',
            value: createdSlotResponse.id,
          },
        ],
      }),
    ]);

    expect(newAppointmentSearch).toBeDefined();
    const unbundled = newAppointmentSearch.unbundle();
    const newAppointment = unbundled.find((r) => r.resourceType === 'Appointment') as Appointment;
    const newSlot = unbundled.find((r) => r.resourceType === 'Slot') as Slot;
    expect(newAppointment).toBeDefined();
    assert(newAppointment);

    expect(newSlot).toBeDefined();
    assert(newSlot.id);
    expect(newSlot.status).toEqual('busy');
    expect(oldSlotSearch).toBeDefined();
    assert(oldSlotSearch);
    const oldSlotList = oldSlotSearch.unbundle();
    expect(oldSlotList).toBeDefined();
    assert(oldSlotList);
    expect(oldSlotList.length).toEqual(0);

    try {
      await oystehr.zambda.executePublic({
        id: 'cancel-appointment',
        appointmentID: appointment.id,
        cancellationReason: 'Patient improved',
      });
    } catch (e) {
      console.error('Error executing update-appointment zambda', e);
    }

    const canceledAppointment = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentID,
    });
    expect(canceledAppointment).toBeDefined();
    assert(canceledAppointment);
    expect(canceledAppointment.status).toEqual('cancelled');
    const slotSearch = await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: '_id',
          value: newSlot.id,
        },
      ],
    });
    expect(slotSearch).toBeDefined();
    const unbundledSlots = slotSearch.unbundle();
    expect(unbundledSlots.length).toBe(0);
  });
});
