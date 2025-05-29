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
  tagForProcessId,
} from '../helpers/testScheduleUtils';
import {
  APIError,
  checkEncounterIsVirtual,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  CreateSlotParams,
  createSlotParamsFromSlotAndOptions,
  getOriginalBookingUrlFromSlot,
  getScheduleExtension,
  GetScheduleResponse,
  getServiceModeFromSlot,
  getSlotIsPostTelemed,
  getSlugForBookableResource,
  getTimezone,
  isPostTelemedAppointment,
  PatientInfo,
  POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR,
  POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  ServiceMode,
  SlotListItem,
  SLUG_SYSTEM,
  Timezone,
} from 'utils';
import { Appointment, Location, Patient, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';

const createSlotAndValidate = async (
  inut: { params: CreateSlotParams; selectedSlot: SlotListItem; schedule: Schedule },
  oystehr: Oystehr
): Promise<{ slot: Slot; serviceMode: ServiceMode | undefined; originalBookingUrl: string | undefined }> => {
  const { params: createSlotParams, selectedSlot, schedule } = inut;
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
    expect(false).toBeTruthy(); // fail the test if we can't create the slot
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
  return {
    slot: createdSlotResponse,
    serviceMode: getServiceModeFromSlot(createdSlotResponse),
    originalBookingUrl: getOriginalBookingUrlFromSlot(createdSlotResponse),
  };
};
interface ValidtateCreateAppointmentResponseInput {
  createAppointmentResponse: CreateAppointmentResponse | undefined;
  patient: Patient | undefined;
  slot: Slot;
  timezone: Timezone;
  isPostTelemed: boolean;
  isVirtual: boolean;
}
const validateCreateAppointmentResponse = (
  input: ValidtateCreateAppointmentResponseInput
): { appointment: Appointment; appointmentId: string } => {
  const { createAppointmentResponse, timezone, patient, slot, isPostTelemed, isVirtual } = input;
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
  assert(appointment.id);
  // this really should be 'booked' for all but there is a known issue https://github.com/masslight/ottehr/issues/2431
  // todo: chage the check to 'booked' once the issue wiht virtual appointments is resolved
  expect(appointment.status).toEqual(isVirtual ? 'arrived' : 'booked');
  assert(appointment.start);
  expect(DateTime.fromISO(appointment.start!, { zone: timezone }).toISO()).toEqual(slot.start);
  expect(appointment.slot?.[0]?.reference).toEqual(`Slot/${slot.id}`);

  expect(encounter).toBeDefined();
  assert(encounter);
  expect(encounter.id);
  expect(encounter.status).toEqual('planned');
  expect(checkEncounterIsVirtual(encounter)).toEqual(isVirtual);
  expect(questionnaire).toBeDefined();
  assert(questionnaire);
  expect(fhirPatient).toBeDefined();
  assert(fhirPatient);
  if (patient) {
    expect(fhirPatient.id).toEqual(patient.id);
  }
  expect(isPostTelemedAppointment(appointment)).toEqual(isPostTelemed);
  return { appointment, appointmentId: appointment.id };
};

interface SetUpOutput {
  timezone: Timezone;
  initialSlotId: string;
  initialSlot: Slot;
  schedule: Schedule;
  locationSlug: string;
  initialAvailableSlots: SlotListItem[];
  initialTelemedAvailableSlots: SlotListItem[];
}
interface RescheduleAndValidateInput {
  slot: Slot;
  appointmentId: string;
  oldSlotId: string;
}

interface CancelAndValidateInput {
  appointmentId: string;
  oldSlotId: string;
}

describe('prebook integration - from getting list of slots to booking with selected slot', () => {
  let oystehr: Oystehr;
  let token = null;
  let processId: string | null = null;
  let existingTestPatient: Patient;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  const setUpInPersonResources = async (postTelemed: boolean): Promise<SetUpOutput> => {
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
    assert(slug);
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

    const { available: regularAvailable, telemedAvailable } = getScheduleResponse;
    const available = postTelemed ? telemedAvailable : regularAvailable;

    const randomIndex = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const selectedSlot = available[randomIndex];
    expect(selectedSlot).toBeDefined();
    assert(selectedSlot);

    const createSlotParams = createSlotParamsFromSlotAndOptions(selectedSlot.slot, {
      walkin: false,
      originalBookingUrl: postTelemed ? undefined : `prebook/in-person?bookingOn=${slug}`,
      status: 'busy-tentative',
      postTelemedLabOnly: postTelemed,
    });

    console.log('createSlotParams', createSlotParams);

    const validatedSlotResponse = await createSlotAndValidate(
      { params: createSlotParams, selectedSlot, schedule },
      oystehr
    );
    let createdSlotResponse = validatedSlotResponse.slot;
    const serviceMode = validatedSlotResponse.serviceMode;
    const bookingUrl = validatedSlotResponse.originalBookingUrl;
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
    assert(createdSlotResponse.id);
    expect(serviceMode).toEqual('in-person');
    if (postTelemed) {
      expect(bookingUrl).toBeUndefined();
    } else {
      expect(bookingUrl).toEqual(`prebook/in-person?bookingOn=${slug}`);
    }
    return {
      timezone,
      initialSlot: createdSlotResponse,
      initialSlotId: createdSlotResponse.id,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
      initialTelemedAvailableSlots: getScheduleResponse?.telemedAvailable ?? [],
    };
  };

  const setUpVirtualResources = async (): Promise<SetUpOutput> => {
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
      name: 'BusySlotsTestTelemedLcocation',
      description: 'We only just met but I will be gone soon',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `busy-slots-slimy-slug-${randomUUID()}`,
        },
      ],
      address: {
        state: 'FL',
      },
      extension: [
        {
          url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
          valueCoding: {
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'vi',
            display: 'Virtual',
          },
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
    assert(slug);
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

    const { available, telemedAvailable } = getScheduleResponse;

    expect(telemedAvailable ?? []).toHaveLength(0);

    const randomIndex = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const selectedSlot = available[randomIndex];
    expect(selectedSlot).toBeDefined();
    assert(selectedSlot);

    const createSlotParams = createSlotParamsFromSlotAndOptions(selectedSlot.slot, {
      walkin: false,
      originalBookingUrl: `prebook/virtual?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    const validatedSlotResponse = await createSlotAndValidate(
      { params: createSlotParams, selectedSlot, schedule },
      oystehr
    );
    const createdSlotResponse = validatedSlotResponse.slot;
    const serviceMode = validatedSlotResponse.serviceMode;
    const bookingUrl = validatedSlotResponse.originalBookingUrl;
    assert(createdSlotResponse.id);
    expect(serviceMode).toEqual('virtual');
    expect(bookingUrl).toEqual(`prebook/virtual?bookingOn=${slug}`);

    return {
      timezone,
      initialSlot: createdSlotResponse,
      initialSlotId: createdSlotResponse.id,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
      initialTelemedAvailableSlots: [],
    };
  };

  const rescheduleAndValidate = async (input: RescheduleAndValidateInput): Promise<void> => {
    const { slot, appointmentId, oldSlotId } = input;
    let rescheduleAppointmentResponse: any | undefined;
    try {
      rescheduleAppointmentResponse = (
        await oystehr.zambda.executePublic({
          id: 'update-appointment',
          appointmentID: appointmentId,
          slot,
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
    expect(appointmentID).toEqual(appointmentId);

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
            value: oldSlotId,
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
    expect(DateTime.fromISO(newAppointment.start!).setZone('UTC').toISO()).toEqual(
      DateTime.fromISO(slot.start).setZone('UTC').toISO()
    );
    expect(DateTime.fromISO(newAppointment.end!).setZone('UTC').toISO()).toEqual(
      DateTime.fromISO(slot.end).setZone('UTC').toISO()
    );

    expect(newSlot).toBeDefined();
    assert(newSlot.id);
    expect(newSlot.status).toEqual('busy');
    expect(oldSlotSearch).toBeDefined();
    assert(oldSlotSearch);
    const oldSlotList = oldSlotSearch.unbundle();
    expect(oldSlotList).toBeDefined();
    assert(oldSlotList);
    expect(oldSlotList.length).toEqual(0);
  };

  const cancelAndValidate = async (input: CancelAndValidateInput): Promise<void> => {
    const { appointmentId, oldSlotId } = input;
    try {
      const cancelResult = await oystehr.zambda.executePublic({
        id: 'cancel-appointment',
        appointmentID: appointmentId,
        cancellationReason: 'Patient improved',
      });
      console.log('cancelResult', JSON.stringify(cancelResult));
      expect(cancelResult.status).toBe(200);
    } catch (e) {
      console.error('Error executing cancel-appointment zambda', e);
      expect(false).toBeTruthy(); // fail the test if we can't cancel the appointment
    }

    const canceledAppointment = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
    });
    expect(canceledAppointment).toBeDefined();
    assert(canceledAppointment);
    expect(canceledAppointment.status).toEqual('cancelled');
    const slotSearch = await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: '_id',
          value: oldSlotId,
        },
      ],
    });
    expect(slotSearch).toBeDefined();
    const unbundledSlots = slotSearch.unbundle();
    expect(unbundledSlots.length).toBe(0);
  };

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
      projectApiUrl: 'http://localhost:3000/local', // todo: env variable
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
    const {
      timezone,
      initialSlotId,
      initialSlot: createdSlotResponse,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
    } = await setUpInPersonResources(false);

    const patient: PatientInfo = {
      id: existingTestPatient.id,
      firstName: existingTestPatient.name![0]!.given![0],
      lastName: existingTestPatient!.name![0]!.family,
      email: 'okovalenko+coolPatient@masslight.com',
      sex: 'female',
      dateOfBirth: existingTestPatient.birthDate,
      newPatient: false,
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const { appointment, appointmentId } = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: existingTestPatient,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: false,
      isVirtual: false,
    });

    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // reschedule the appointment and make sure everything still looks good
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

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse: Slot = validatedRescheduledSlot.slot;
    const serviceMode = validatedRescheduledSlot.serviceMode;
    const bookingUrl = validatedRescheduledSlot.originalBookingUrl;
    assert(rescheduleSlotResponse.id);
    expect(serviceMode).toEqual('in-person');
    expect(bookingUrl).toEqual(`prebook/in-person?bookingOn=${slug}`);

    await rescheduleAndValidate({
      slot: rescheduleSlotResponse,
      appointmentId: appointment.id!,
      oldSlotId: initialSlotId,
    });
    try {
      const cancelResult = await oystehr.zambda.executePublic({
        id: 'cancel-appointment',
        appointmentID: appointment.id,
        cancellationReason: 'Patient improved',
      });
      console.log('cancelResult', JSON.stringify(cancelResult));
      expect(cancelResult.status).toBe(200);
    } catch (e) {
      console.error('Error executing cancel-appointment zambda', e);
      expect(false).toBeTruthy(); // fail the test if we can't cancel the appointment
    }

    const canceledAppointment = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
    });
    expect(canceledAppointment).toBeDefined();
    assert(canceledAppointment);
    expect(canceledAppointment.status).toEqual('cancelled');
    const slotSearch = await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: '_id',
          value: rescheduleSlotResponse.id,
        },
      ],
    });
    expect(slotSearch).toBeDefined();
    const unbundledSlots = slotSearch.unbundle();
    expect(unbundledSlots.length).toBe(0);
  });

  it('successfully creates a virtual appointment for a returning patient after selecting an available slot', async () => {
    const {
      timezone,
      initialSlotId,
      initialSlot: createdSlotResponse,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
    } = await setUpVirtualResources();

    const patient: PatientInfo = {
      id: existingTestPatient.id,
      firstName: existingTestPatient.name![0]!.given![0],
      lastName: existingTestPatient!.name![0]!.family,
      sex: 'female',
      email: 'okovalenko+coolPatient@masslight.com',
      dateOfBirth: existingTestPatient.birthDate,
      newPatient: false,
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const { appointment, appointmentId } = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: existingTestPatient,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: false,
      isVirtual: true,
    });

    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // reschedule the appointment and make sure everything still looks good
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

    const { available: newAvailable } = getScheduleResponse;

    const index = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const rescheduleSlot = newAvailable[index];
    expect(rescheduleSlot).toBeDefined();
    assert(rescheduleSlot);

    const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
      walkin: false,
      originalBookingUrl: `prebook/virtual?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse = validatedRescheduledSlot.slot;
    const serviceMode = validatedRescheduledSlot.serviceMode;
    const bookingUrl = validatedRescheduledSlot.originalBookingUrl;
    assert(rescheduleSlotResponse.id);
    expect(getSlotIsPostTelemed(createdSlotResponse)).toEqual(false);
    expect(serviceMode).toEqual('virtual');
    expect(bookingUrl).toEqual(`prebook/virtual?bookingOn=${slug}`);

    await rescheduleAndValidate({
      slot: rescheduleSlotResponse,
      appointmentId: appointment.id!,
      oldSlotId: initialSlotId,
    });
    await cancelAndValidate({
      appointmentId,
      oldSlotId: rescheduleSlotResponse.id,
    });
  });

  it('successfully creates a post-telemed appointment for a returning patient after selecting an available slot', async () => {
    const {
      timezone,
      initialSlotId,
      initialSlot: createdSlotResponse,
      schedule,
      locationSlug: slug,
      initialTelemedAvailableSlots: available,
    } = await setUpInPersonResources(true);

    const patient: PatientInfo = {
      id: existingTestPatient.id,
      firstName: existingTestPatient.name![0]!.given![0],
      lastName: existingTestPatient!.name![0]!.family,
      email: 'okovalenko+coolPatient@masslight.com',
      sex: 'female',
      dateOfBirth: existingTestPatient.birthDate,
      newPatient: false,
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const { appointment } = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: existingTestPatient,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: true,
      isVirtual: false,
    });

    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // post-telemed appointments can't be rescheduled
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

    const { telemedAvailable: newAvailable } = getScheduleResponse;

    const index = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const rescheduleSlot = newAvailable[index];
    expect(rescheduleSlot).toBeDefined();
    assert(rescheduleSlot);

    const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
      walkin: false,
      postTelemedLabOnly: true,
      status: 'busy-tentative',
    });

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse = validatedRescheduledSlot.slot;
    assert(rescheduleSlotResponse.id);
    expect(getSlotIsPostTelemed(createdSlotResponse)).toEqual(true);

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
      const apiError = e as APIError;
      expect(apiError.message).toEqual(POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR.message);
      expect(apiError.code).toEqual(POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR.code);
    }
    expect(rescheduleAppointmentResponse).toBeUndefined();

    // post-telemed appointments can't be canceled either
    try {
      await oystehr.zambda.executePublic({
        id: 'cancel-appointment',
        appointmentID: appointment.id,
        cancellationReason: 'Patient improved',
      });
    } catch (e) {
      console.error('Error executing cancel-appointment zambda', e);
      const apiError = e as APIError;
      expect(apiError.message).toEqual(POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR.message);
      expect(apiError.code).toEqual(POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR.code);
    }

    const canceledAppointment = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointment.id!,
    });
    expect(canceledAppointment).toBeDefined();
    assert(canceledAppointment);
    expect(canceledAppointment.status).toEqual('booked'); // should still be booked since we can't cancel it
  });

  it('successfully creates an in person appointment for a new patient after selecting an available slot', async () => {
    assert(processId);
    const {
      timezone,
      initialSlotId,
      initialSlot: createdSlotResponse,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
    } = await setUpInPersonResources(false);

    const newPatient = makeTestPatient();
    const patient: PatientInfo = {
      firstName: newPatient.name![0]!.given![0],
      lastName: newPatient.name![0]!.family,
      sex: 'female',
      dateOfBirth: newPatient.birthDate,
      newPatient: true,
      phoneNumber: '+12027139680',
      email: 'okovalenko+coolNewPatient@masslight.com',
      tags: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'a test resource that should be cleaned up',
        },
      ],
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const { appointment, appointmentId } = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: undefined,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: false,
      isVirtual: false,
    });
    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // reschedule the appointment and make sure everything still looks good
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

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse: Slot = validatedRescheduledSlot.slot;
    const serviceMode = validatedRescheduledSlot.serviceMode;
    const bookingUrl = validatedRescheduledSlot.originalBookingUrl;
    assert(rescheduleSlotResponse.id);
    expect(serviceMode).toEqual('in-person');
    expect(bookingUrl).toEqual(`prebook/in-person?bookingOn=${slug}`);

    await rescheduleAndValidate({
      slot: rescheduleSlotResponse,
      appointmentId: appointment.id!,
      oldSlotId: initialSlotId,
    });

    await cancelAndValidate({
      appointmentId,
      oldSlotId: rescheduleSlotResponse.id,
    });
  });

  it('successfully creates a virtual appointment for a new patient after selecting an available slot', async () => {
    assert(processId);
    const {
      timezone,
      initialSlotId,
      initialSlot: createdSlotResponse,
      schedule,
      locationSlug: slug,
      initialAvailableSlots: available,
    } = await setUpVirtualResources();

    const newPatient = makeTestPatient();
    const patient: PatientInfo = {
      firstName: newPatient.name![0]!.given![0],
      lastName: newPatient.name![0]!.family,
      sex: 'female',
      dateOfBirth: newPatient.birthDate,
      newPatient: true,
      phoneNumber: '+12027139680',
      email: 'okovalenko+coolNewPatient@masslight.com',
      tags: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'a test resource that should be cleaned up',
        },
      ],
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const { appointment, appointmentId } = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: undefined,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: false,
      isVirtual: true,
    });
    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    // reschedule the appointment and make sure everything still looks good
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

    const { available: newAvailable } = getScheduleResponse;

    const index = Math.ceil(Math.random() * (available.length - 1)) - 1;
    const rescheduleSlot = newAvailable[index];
    expect(rescheduleSlot).toBeDefined();
    assert(rescheduleSlot);

    const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
      walkin: false,
      originalBookingUrl: `prebook/virtual?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse: Slot = validatedRescheduledSlot.slot;
    const serviceMode = validatedRescheduledSlot.serviceMode;
    const bookingUrl = validatedRescheduledSlot.originalBookingUrl;
    assert(rescheduleSlotResponse.id);
    expect(serviceMode).toEqual('virtual');
    expect(bookingUrl).toEqual(`prebook/virtual?bookingOn=${slug}`);

    await rescheduleAndValidate({
      slot: rescheduleSlotResponse,
      appointmentId: appointment.id!,
      oldSlotId: initialSlotId,
    });

    await cancelAndValidate({
      appointmentId,
      oldSlotId: rescheduleSlotResponse.id,
    });
  });

  // irl this use case doesn't make sense, but there is nothing preventing this scenario from being initiated
  // by an EHR user, so might as well test it
  it('successfully creates a post-telemed appointment for a new patient after selecting an available slot', async () => {
    assert(processId);
    const { timezone, initialSlotId, initialSlot: createdSlotResponse } = await setUpInPersonResources(true);

    const newPatient = makeTestPatient();
    const patient: PatientInfo = {
      firstName: newPatient.name![0]!.given![0],
      lastName: newPatient.name![0]!.family,
      sex: 'female',
      dateOfBirth: newPatient.birthDate,
      newPatient: true,
      phoneNumber: '+12027139680',
      email: 'okovalenko+coolNewPatient@masslight.com',
      tags: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'a test resource that should be cleaned up',
        },
      ],
    };

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient,
      slotId: initialSlotId,
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
    const _ = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient: undefined,
      slot: createdSlotResponse,
      timezone,
      isPostTelemed: true,
      isVirtual: false,
    });
    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: initialSlotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');
  });
});
