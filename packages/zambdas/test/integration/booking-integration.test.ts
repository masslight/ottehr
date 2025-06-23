import Oystehr from '@oystehr/sdk';
import { assert, inject } from 'vitest';
import { getAuth0Token } from '../../src/shared';
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
  appointmentTypeForAppointment,
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
  getSlotIsWalkin,
  getSlugForBookableResource,
  getTimezone,
  isPostTelemedAppointment,
  PatientInfo,
  POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR,
  POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  ScheduleOwnerFhirResource,
  ServiceMode,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotListItem,
  SlotServiceCategory,
  SLUG_SYSTEM,
  Timezone,
} from 'utils';
import { Appointment, Location, Patient, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';

const createSlotAndValidate = async (
  input: { params: CreateSlotParams; schedule: Schedule; selectedSlot?: SlotListItem },
  oystehr: Oystehr
): Promise<{ slot: Slot; serviceMode: ServiceMode | undefined; originalBookingUrl: string | undefined }> => {
  const { params: createSlotParams, selectedSlot, schedule } = input;
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
  if (selectedSlot) {
    expect(createdSlotResponse.start).toEqual(selectedSlot.slot.start);
    expect(createdSlotResponse.end).toEqual(
      DateTime.fromISO(selectedSlot.slot.end, { zone: getTimezone(schedule) }).toISO()
    );
  }

  expect(getSlotIsWalkin(createdSlotResponse)).toEqual(createSlotParams.walkin ?? false);
  expect(getSlotIsPostTelemed(createdSlotResponse)).toEqual(createSlotParams.postTelemedLabOnly ?? false);
  return {
    slot: createdSlotResponse,
    serviceMode: getServiceModeFromSlot(createdSlotResponse),
    originalBookingUrl: getOriginalBookingUrlFromSlot(createdSlotResponse),
  };
};
interface ValidateCreateAppointmentResponseInput {
  createAppointmentResponse: CreateAppointmentResponse | undefined;
  patient: Patient | undefined;
  slot: Slot;
  timezone: Timezone;
}
interface ValidatedCreateAppointmentResponseOutput {
  appointment: Appointment;
  appointmentId: string;
}

interface CreateAppointmentInput {
  patientInfo: PatientInfo;
  slot: Slot;
  timezone: Timezone;
  patient?: Patient;
}
const validateCreateAppointmentResponse = (
  input: ValidateCreateAppointmentResponseInput
): ValidatedCreateAppointmentResponseOutput => {
  const { createAppointmentResponse, timezone, patient, slot } = input;
  expect(createAppointmentResponse).toBeDefined();
  assert(createAppointmentResponse);
  const { appointmentId, fhirPatientId, questionnaireResponseId, encounterId, resources } = createAppointmentResponse;
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
  const isWalkin = getSlotIsWalkin(slot);
  const isPostTelemed = getSlotIsPostTelemed(slot);
  const isVirtual = checkEncounterIsVirtual(encounter);
  // this really should be 'booked' for all but there is a known issue https://github.com/masslight/ottehr/issues/2431
  // todo: change the check to 'booked' once the issue with virtual appointments is resolved
  expect(appointment.status).toEqual(isVirtual || isWalkin ? 'arrived' : 'booked');
  assert(appointment.start);
  if (isWalkin) {
    const appointmentTimeStamp = DateTime.fromISO(appointment.start!, { zone: timezone }).toUnixInteger();
    const slotTimeStamp = DateTime.fromISO(slot.start).toUnixInteger();
    const timeDiff = appointmentTimeStamp - slotTimeStamp;
    // start time is calculated on the fly in the create-appointment zambda, expecting the appointment
    // time to be within 10 seconds of the slot start time should be adequate precision here
    expect(timeDiff).toBeGreaterThanOrEqual(0);
    expect(timeDiff).toBeLessThanOrEqual(10);
  } else {
    expect(DateTime.fromISO(appointment.start!, { zone: timezone }).toISO()).toEqual(slot.start);
  }
  expect(appointment.slot?.[0]?.reference).toEqual(`Slot/${slot.id}`);

  expect(encounter).toBeDefined();
  assert(encounter);
  expect(encounter.id);
  // todo: should encounter status be 'arrived' for walkin virtual appointments to match the appointment status?
  // i think this is intended and helps with some intake logic particular to the virtual walkin flow
  if (isWalkin && !isVirtual) {
    expect(encounter.status).toEqual('arrived');
  } else {
    expect(encounter.status).toEqual('planned');
  }
  expect(checkEncounterIsVirtual(encounter)).toEqual(isVirtual);
  expect(questionnaire).toBeDefined();
  assert(questionnaire);
  expect(fhirPatient).toBeDefined();
  assert(fhirPatient);
  if (patient) {
    expect(fhirPatient.id).toEqual(patient.id);
  }

  const slotIsWalkin = getSlotIsWalkin(slot);
  const appointmentType = appointmentTypeForAppointment(appointment);
  if (slotIsWalkin) {
    expect(appointmentType).toEqual('walk-in');
  } else if (isPostTelemed) {
    expect(appointmentType).toEqual('post-telemed');
  } else {
    expect(appointmentType).toEqual('pre-booked');
  }

  expect(isPostTelemedAppointment(appointment)).toEqual(isPostTelemed);
  return { appointment, appointmentId: appointment.id };
};

interface SetUpOutput {
  timezone: Timezone;
  schedule: Schedule;
  scheduleOwnerType: ScheduleOwnerFhirResource['resourceType'];
  slug: string;
}

interface GetSlotFromScheduleInput extends SetUpOutput {
  serviceMode: ServiceMode;
  isWalkin?: boolean;
  isPostTelemed?: boolean;
}

interface GetSlotFromScheduleOutput {
  slot: Slot;
  slotId: string;
}

interface RescheduleAndValidateInput {
  appointmentId: string;
  oldSlotId: string;
  slug: string;
  serviceMode: ServiceMode;
  schedule: Schedule;
}

interface RescheduleAndValidateOutput {
  newSlotId: string;
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

  const setUpInPersonResources = async (): Promise<SetUpOutput> => {
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
      name: 'BusySlotsTestLocation',
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

    return {
      timezone,
      schedule,
      slug,
      scheduleOwnerType: owner.resourceType,
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
      name: 'BusySlotsTestTelemedLocation',
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

    return {
      timezone,
      schedule,
      slug,
      scheduleOwnerType: owner.resourceType,
    };
  };

  const getSlot = async (input: GetSlotFromScheduleInput): Promise<GetSlotFromScheduleOutput> => {
    const { schedule, scheduleOwnerType, isWalkin, isPostTelemed, slug, serviceMode } = input;

    let getScheduleResponse: GetScheduleResponse | undefined;
    try {
      getScheduleResponse = (
        await oystehr.zambda.executePublic({
          id: 'get-schedule',
          slug,
          scheduleType: scheduleOwnerType === 'Location' ? 'location' : 'provider',
        })
      ).output as GetScheduleResponse;
    } catch (e) {
      console.error('Error executing get-schedule zambda', e);
    }
    expect(getScheduleResponse).toBeDefined();
    assert(getScheduleResponse);

    let selectedSlot: SlotListItem | undefined;
    if (!isWalkin) {
      const { available: regularAvailable, telemedAvailable } = getScheduleResponse;

      if (serviceMode === ServiceMode.virtual) {
        expect(telemedAvailable ?? []).toHaveLength(0);
      }

      const available = isPostTelemed ? telemedAvailable : regularAvailable;

      const randomIndex = Math.ceil(Math.random() * (available.length - 1)) - 1;
      selectedSlot = available[randomIndex];
      expect(selectedSlot).toBeDefined();
      assert(selectedSlot);
    }

    let createSlotParams: CreateSlotParams;

    if (selectedSlot === undefined && isWalkin) {
      // set createSlotParams to
      const now = DateTime.now().setZone(getTimezone(schedule));
      const end = now.plus({ minutes: 15 }).toISO()!;

      // todo: make this a util used by the source code as well as here
      const walkinSlot: Slot = {
        resourceType: 'Slot',
        start: now.toISO()!,
        end,
        schedule: { reference: `Schedule/${schedule.id}` },
        status: 'busy-tentative',
        appointmentType: { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING },
        serviceCategory:
          serviceMode === ServiceMode.virtual
            ? [SlotServiceCategory.virtualServiceMode]
            : [SlotServiceCategory.inPersonServiceMode],
      };
      createSlotParams = createSlotParamsFromSlotAndOptions(walkinSlot, {
        postTelemedLabOnly: isPostTelemed ?? false,
        status: 'busy-tentative',
      });
    } else {
      assert(selectedSlot);
      createSlotParams = createSlotParamsFromSlotAndOptions(selectedSlot.slot, {
        postTelemedLabOnly: isPostTelemed ?? false,
        originalBookingUrl: isWalkin || isPostTelemed ? undefined : `prebook/${serviceMode}?bookingOn=${slug}`,
        status: 'busy-tentative',
      });
    }
    assert(createSlotParams);
    const validatedSlotResponse = await createSlotAndValidate(
      { params: createSlotParams, selectedSlot, schedule },
      oystehr
    );
    const createdSlotResponse = validatedSlotResponse.slot;
    const serviceModeFromSlot = validatedSlotResponse.serviceMode;
    const bookingUrl = validatedSlotResponse.originalBookingUrl;
    assert(createdSlotResponse.id);
    expect(serviceModeFromSlot).toEqual(serviceMode);
    if (!isWalkin && !isPostTelemed) {
      expect(bookingUrl).toEqual(`prebook/${serviceMode}?bookingOn=${slug}`);
    } else {
      expect(bookingUrl).toBeUndefined();
    }

    return {
      slot: createdSlotResponse,
      slotId: createdSlotResponse.id,
    };
  };

  const rescheduleAndValidate = async (input: RescheduleAndValidateInput): Promise<RescheduleAndValidateOutput> => {
    const { appointmentId, oldSlotId, slug, schedule, serviceMode } = input;

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

    const index = Math.ceil(Math.random() * (newAvailable.length - 1)) - 1;
    const rescheduleSlot = newAvailable[index];
    expect(rescheduleSlot).toBeDefined();
    assert(rescheduleSlot);

    const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
      originalBookingUrl: `prebook/${serviceMode}?bookingOn=${slug}`,
      status: 'busy-tentative',
    });

    const validatedRescheduledSlot = await createSlotAndValidate(
      { params: rescheduleSlotParams, selectedSlot: rescheduleSlot, schedule },
      oystehr
    );
    const rescheduleSlotResponse: Slot = validatedRescheduledSlot.slot;
    const slotServiceMode = validatedRescheduledSlot.serviceMode;
    const bookingUrl = validatedRescheduledSlot.originalBookingUrl;
    assert(rescheduleSlotResponse.id);
    expect(slotServiceMode).toEqual(serviceMode);
    expect(bookingUrl).toEqual(`prebook/${serviceMode}?bookingOn=${slug}`);

    let rescheduleAppointmentResponse: any | undefined;
    try {
      rescheduleAppointmentResponse = (
        await oystehr.zambda.executePublic({
          id: 'update-appointment',
          appointmentID: appointmentId,
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
      DateTime.fromISO(rescheduleSlotResponse.start).setZone('UTC').toISO()
    );
    expect(DateTime.fromISO(newAppointment.end!).setZone('UTC').toISO()).toEqual(
      DateTime.fromISO(rescheduleSlotResponse.end).setZone('UTC').toISO()
    );
    expect(DateTime.fromISO(newAppointment.start!).setZone('UTC').toISO()).toEqual(
      DateTime.fromISO(newSlot.start).setZone('UTC').toISO()
    );
    expect(DateTime.fromISO(newAppointment.end!).setZone('UTC').toISO()).toEqual(
      DateTime.fromISO(newSlot.end).setZone('UTC').toISO()
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

    return {
      newSlotId: newSlot.id,
    };
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

  const createAppointmentAndValidate = async (
    input: CreateAppointmentInput
  ): Promise<ValidatedCreateAppointmentResponseOutput> => {
    const { patientInfo, patient, timezone, slot } = input;
    const slotId = slot.id;
    assert(slotId);
    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient: patientInfo,
      slotId,
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
    const validated = validateCreateAppointmentResponse({
      createAppointmentResponse,
      patient,
      slot,
      timezone,
    });

    const fetchedSlot = await oystehr.fhir.get<Slot>({
      resourceType: 'Slot',
      id: slotId,
    });
    expect(fetchedSlot).toBeDefined();
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    return validated;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
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

  test.concurrent(
    'successfully creates an in person appointment for a returning patient after selecting an available slot',
    async () => {
      const initialResources = await setUpInPersonResources();
      const { timezone, schedule, slug } = initialResources;

      const patientInfo: PatientInfo = {
        id: existingTestPatient.id,
        firstName: existingTestPatient.name![0]!.given![0],
        lastName: existingTestPatient!.name![0]!.family,
        email: 'okovalenko+coolPatient@masslight.com',
        sex: 'female',
        dateOfBirth: existingTestPatient.birthDate,
        newPatient: false,
      };

      const { slot: createdSlotResponse, slotId: initialSlotId } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode['in-person'],
        isWalkin: false,
        isPostTelemed: false,
      });

      const { appointmentId } = await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: existingTestPatient,
        slot: createdSlotResponse,
      });

      const { newSlotId } = await rescheduleAndValidate({
        appointmentId,
        oldSlotId: initialSlotId,
        slug,
        serviceMode: ServiceMode['in-person'],
        schedule,
      });

      await cancelAndValidate({
        appointmentId,
        oldSlotId: newSlotId,
      });
    }
  );

  test.concurrent(
    'successfully creates a virtual appointment for a returning patient after selecting an available slot',
    async () => {
      const initialResources = await setUpVirtualResources();
      const { timezone, schedule, slug } = initialResources;

      const patientInfo: PatientInfo = {
        id: existingTestPatient.id,
        firstName: existingTestPatient.name![0]!.given![0],
        lastName: existingTestPatient!.name![0]!.family,
        sex: 'female',
        email: 'okovalenko+coolPatient@masslight.com',
        dateOfBirth: existingTestPatient.birthDate,
        newPatient: false,
      };

      const { slot: createdSlotResponse, slotId: initialSlotId } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode.virtual,
        isWalkin: false,
        isPostTelemed: false,
      });

      const { appointmentId } = await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: existingTestPatient,
        slot: createdSlotResponse,
      });

      const { newSlotId } = await rescheduleAndValidate({
        appointmentId,
        oldSlotId: initialSlotId,
        slug,
        serviceMode: ServiceMode.virtual,
        schedule,
      });
      await cancelAndValidate({
        appointmentId,
        oldSlotId: newSlotId,
      });
    }
  );

  test.concurrent(
    'successfully creates a post-telemed appointment for a returning patient after selecting an available slot',
    async () => {
      const initialResources = await setUpInPersonResources();
      const { timezone, schedule, slug } = initialResources;

      const patientInfo: PatientInfo = {
        id: existingTestPatient.id,
        firstName: existingTestPatient.name![0]!.given![0],
        lastName: existingTestPatient!.name![0]!.family,
        email: 'okovalenko+coolPatient@masslight.com',
        sex: 'female',
        dateOfBirth: existingTestPatient.birthDate,
        newPatient: false,
      };

      const { slot: createdSlotResponse } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode['in-person'],
        isWalkin: false,
        isPostTelemed: true,
      });

      const { appointment } = await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: existingTestPatient,
        slot: createdSlotResponse,
      });

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

      const index = Math.ceil(Math.random() * (newAvailable.length - 1)) - 1;
      const rescheduleSlot = newAvailable[index];
      expect(rescheduleSlot).toBeDefined();
      assert(rescheduleSlot);

      const rescheduleSlotParams = createSlotParamsFromSlotAndOptions(rescheduleSlot.slot, {
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
    }
  );

  test.concurrent(
    'successfully creates an in person appointment for a new patient after selecting an available slot',
    async () => {
      assert(processId);
      const initialResources = await setUpInPersonResources();
      const { timezone, schedule, slug } = initialResources;

      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
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

      const { slot: createdSlotResponse, slotId } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode['in-person'],
        isWalkin: false,
        isPostTelemed: false,
      });

      const { appointmentId } = await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: undefined,
        slot: createdSlotResponse,
      });

      const { newSlotId } = await rescheduleAndValidate({
        oldSlotId: slotId,
        appointmentId: appointmentId,
        slug,
        serviceMode: ServiceMode['in-person'],
        schedule,
      });

      await cancelAndValidate({
        appointmentId,
        oldSlotId: newSlotId,
      });
    }
  );

  test.concurrent(
    'successfully creates a virtual appointment for a new patient after selecting an available slot',
    async () => {
      assert(processId);
      const initialResources = await setUpVirtualResources();
      const { timezone, schedule, slug } = initialResources;

      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
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

      const { slot: createdSlotResponse, slotId } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode.virtual,
        isWalkin: false,
        isPostTelemed: false,
      });

      const { appointmentId } = await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: undefined,
        slot: createdSlotResponse,
      });

      const { newSlotId } = await rescheduleAndValidate({
        oldSlotId: slotId,
        slug,
        serviceMode: ServiceMode.virtual,
        schedule,
        appointmentId,
      });

      await cancelAndValidate({
        appointmentId,
        oldSlotId: newSlotId,
      });
    }
  );

  // irl this use case doesn't make sense, but there is nothing preventing this scenario from being initiated
  // by an EHR user, so might as well test it
  test.concurrent(
    'successfully creates a post-telemed appointment for a new patient after selecting an available slot',
    async () => {
      assert(processId);
      const initialResources = await setUpInPersonResources();
      const { timezone } = initialResources;

      const { slot: createdSlotResponse } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode['in-person'],
        isWalkin: false,
        isPostTelemed: true,
      });

      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
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

      await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: undefined,
        slot: createdSlotResponse,
      });
    }
  );
  describe('walkin appointments', () => {
    test.concurrent(
      'successfully creates an in-person walkin appointment for a new patient after selecting an available slot',
      async () => {
        assert(processId);
        const initialResources = await setUpInPersonResources();
        const { timezone } = initialResources;
        const newPatient = makeTestPatient();
        const patientInfo: PatientInfo = {
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
        const { slot: createdSlotResponse } = await getSlot({
          ...initialResources,
          serviceMode: ServiceMode['in-person'],
          isWalkin: true,
          isPostTelemed: false,
        });
        await createAppointmentAndValidate({
          timezone,
          patientInfo,
          patient: undefined,
          slot: createdSlotResponse,
        });
      }
    );
    test.concurrent(
      'successfully creates an in-person walkin appointment for an existing patient after selecting an available slot',
      async () => {
        assert(processId);
        const initialResources = await setUpInPersonResources();
        const { timezone } = initialResources;
        const patientInfo: PatientInfo = {
          id: existingTestPatient.id,
          firstName: existingTestPatient.name![0]!.given![0],
          lastName: existingTestPatient!.name![0]!.family,
          sex: 'female',
          email: 'okovalenko+coolPatient@masslight.com',
          dateOfBirth: existingTestPatient.birthDate,
          newPatient: false,
        };
        const { slot: createdSlotResponse } = await getSlot({
          ...initialResources,
          serviceMode: ServiceMode['in-person'],
          isWalkin: true,
          isPostTelemed: false,
        });
        await createAppointmentAndValidate({
          timezone,
          patientInfo,
          patient: existingTestPatient,
          slot: createdSlotResponse,
        });
      }
    );
    test.concurrent('successfully creates a virtual walkin appointment for a new patient', async () => {
      assert(processId);
      const initialResources = await setUpVirtualResources();
      const { timezone } = initialResources;
      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
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
      const { slot: createdSlotResponse } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode.virtual,
        isWalkin: true,
        isPostTelemed: false,
      });
      await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: undefined,
        slot: createdSlotResponse,
      });
    });
    test.concurrent('successfully creates a virtual walkin appointment for an existing patient', async () => {
      assert(processId);
      const initialResources = await setUpVirtualResources();
      const { timezone } = initialResources;
      const patientInfo: PatientInfo = {
        id: existingTestPatient.id,
        firstName: existingTestPatient.name![0]!.given![0],
        lastName: existingTestPatient!.name![0]!.family,
        sex: 'female',
        email: 'okovalenko+coolPatient@masslight.com',
        dateOfBirth: existingTestPatient.birthDate,
        newPatient: false,
      };
      const { slot: createdSlotResponse } = await getSlot({
        ...initialResources,
        serviceMode: ServiceMode.virtual,
        isWalkin: true,
        isPostTelemed: false,
      });
      await createAppointmentAndValidate({
        timezone,
        patientInfo,
        patient: existingTestPatient,
        slot: createdSlotResponse,
      });
    });
  });
});
