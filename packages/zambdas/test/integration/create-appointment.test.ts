import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, FhirResource, Location, Patient, Practitioner, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
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
  getSlotAtLocationId,
  getSlotIsPostTelemed,
  getSlotIsWalkin,
  getSlugForBookableResource,
  getTimezone,
  isPostTelemedAppointment,
  makeSlotAtLocationExtensionEntry,
  PatientInfo,
  SCHEDULE_EXTENSION_URL,
  ScheduleOwnerFhirResource,
  ServiceMode,
  SlotListItem,
  SLUG_SYSTEM,
  Timezone,
} from 'utils';
import { assert, inject } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import {
  buildSimpleScheduleExt,
  cleanupTestScheduleResources,
  makeTestPatient,
  persistSchedule,
  startOfDayWithTimezone,
  tagForProcessId,
} from '../helpers/testScheduleUtils';

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
  assert(createdSlotResponse);
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
  assert(createAppointmentResponse);
  const { appointmentId, fhirPatientId, questionnaireResponseId, encounterId, resources } = createAppointmentResponse;
  assert(appointmentId);
  assert(fhirPatientId);
  assert(questionnaireResponseId);
  assert(encounterId);
  assert(resources);

  const { appointment, encounter, questionnaire, patient: fhirPatient } = resources;
  assert(appointment);
  assert(appointment.id);
  expect(appointment.id).toEqual(appointmentId);
  const isWalkin = getSlotIsWalkin(slot);
  const isPostTelemed = getSlotIsPostTelemed(slot);
  const isVirtual = checkEncounterIsVirtual(encounter);
  expect(appointment.status).toEqual(isWalkin && !isVirtual ? 'arrived' : 'booked');
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

  assert(encounter);
  assert(encounter.id);
  if (isWalkin && !isVirtual) {
    expect(encounter.status).toEqual('arrived');
  } else {
    expect(encounter.status).toEqual('planned');
  }
  expect(checkEncounterIsVirtual(encounter)).toEqual(isVirtual);
  assert(questionnaire);
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
  isWalkin: false;
  isPostTelemed: false;
}

interface GetSlotFromScheduleOutput {
  slot: Slot;
  slotId: string;
}

describe('prebook integration - from getting list of slots to booking with selected slot', () => {
  let oystehr: Oystehr;
  let token = null;
  let processId: string | null = null;

  const setUpInPersonResources = async (): Promise<SetUpOutput> => {
    expect(oystehr).toBeDefined();
    // 24/7 open with 4 bookings/hour (slot-length-invariant).
    const adjustedScheduleJSON = buildSimpleScheduleExt({ prebookSlots: 4 });

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
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    assert(owner);
    const slug = getSlugForBookableResource(owner);
    assert(slug);

    return {
      timezone,
      schedule,
      slug,
      scheduleOwnerType: owner.resourceType,
    };
  };

  const getSlot = async (input: GetSlotFromScheduleInput): Promise<GetSlotFromScheduleOutput> => {
    const { schedule, scheduleOwnerType, slug, serviceMode } = input;

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
    assert(getScheduleResponse);

    const { available } = getScheduleResponse;

    console.log('available slots ', available);

    const elevenPMSlot = available.find((slotItem) => {
      const slotStartTime = DateTime.fromISO(slotItem.slot.start);
      return slotStartTime.hour === 23;
    });

    assert(elevenPMSlot);
    console.log('selectedSlot ', elevenPMSlot);
    const createSlotParams = createSlotParamsFromSlotAndOptions(elevenPMSlot.slot, {
      postTelemedLabOnly: false,
      originalBookingUrl: `prebook/${serviceMode}?bookingOn=${slug}`,
      status: 'busy-tentative',
    });
    console.log('createSlotParams ', createSlotParams);
    assert(createSlotParams);
    const validatedSlotResponse = await createSlotAndValidate(
      { params: createSlotParams, selectedSlot: elevenPMSlot, schedule },
      oystehr
    );
    console.log('validatedSlotResponse ', validatedSlotResponse);
    const createdSlotResponse = validatedSlotResponse.slot;
    const serviceModeFromSlot = validatedSlotResponse.serviceMode;
    const bookingUrl = validatedSlotResponse.originalBookingUrl;
    assert(createdSlotResponse.id);
    expect(serviceModeFromSlot).toEqual(serviceMode);
    expect(bookingUrl).toEqual(`prebook/${serviceMode}?bookingOn=${slug}`);

    return {
      slot: createdSlotResponse,
      slotId: createdSlotResponse.id,
    };
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
    assert(fetchedSlot);
    expect(fetchedSlot.status).toEqual('busy');

    return validated;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      services: {
        zambdaApiUrl: EXECUTE_ZAMBDA_URL,
      },
      projectId: PROJECT_ID,
    });
  });

  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    await cleanupTestScheduleResources(processId, oystehr);
  });

  // PR-actored Schedule end-to-end: vended Slot must carry the slot-at-
  // location extension, the extension must round-trip through create-slot,
  // and create-appointment must attribute the Appointment to the right
  // Location. Exercises the FHIR plumbing for the slot-at-location
  // extension; the resolution-precedence logic itself is covered
  // exhaustively in unit tests (resolveBookingLocationId.test.ts).
  test('PR-actored schedule stamps and persists slot-at-location extension end-to-end', async () => {
    assert(processId);
    const tag = {
      system: 'OTTEHR_AUTOMATED_TEST',
      code: tagForProcessId(processId),
      display: 'integration test fixture',
    };
    const scheduleJson = buildSimpleScheduleExt({ prebookSlots: 4 });
    // Used below to position the test's faux vended slot well into the
    // schedule's open window (today midnight + 20h = today 8pm).
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    // Build Practitioner + Location + PR + Schedule (actor = PR) in one
    // FHIR transaction so they're all wired up together at create time.
    const practitionerUrn = `urn:uuid:${randomUUID()}`;
    const locationUrn = `urn:uuid:${randomUUID()}`;
    const prUrn = `urn:uuid:${randomUUID()}`;
    const locationSlug = `pr-integration-loc-${randomUUID()}`;

    const fixtureRequests: BatchInputPostRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: 'Practitioner',
        fullUrl: practitionerUrn,
        resource: {
          resourceType: 'Practitioner',
          name: [{ family: 'TestProvider', given: ['Integration'] }],
          meta: { tag: [tag] },
        },
      },
      {
        method: 'POST',
        url: 'Location',
        fullUrl: locationUrn,
        resource: {
          resourceType: 'Location',
          status: 'active',
          name: 'PR-Integration-Location',
          identifier: [{ system: SLUG_SYSTEM, value: locationSlug }],
          meta: { tag: [tag] },
        },
      },
      {
        method: 'POST',
        url: 'PractitionerRole',
        fullUrl: prUrn,
        resource: {
          resourceType: 'PractitionerRole',
          active: true,
          practitioner: { reference: practitionerUrn },
          location: [{ reference: locationUrn }],
          meta: { tag: [tag] },
        },
      },
      {
        method: 'POST',
        url: 'Schedule',
        resource: {
          resourceType: 'Schedule',
          actor: [{ reference: prUrn }],
          extension: [
            {
              url: 'http://hl7.org/fhir/StructureDefinition/timezone',
              valueString: 'America/New_York',
            },
            { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(scheduleJson) },
          ],
          meta: { tag: [tag] },
        },
      },
    ];

    const txResult = await oystehr.fhir.transaction({ requests: fixtureRequests });
    const persistedPractitioner = txResult.entry?.find((e) => e.resource?.resourceType === 'Practitioner')
      ?.resource as Practitioner;
    const persistedLocation = txResult.entry?.find((e) => e.resource?.resourceType === 'Location')
      ?.resource as Location;
    const persistedPR = txResult.entry?.find((e) => e.resource?.resourceType === 'PractitionerRole')
      ?.resource as PractitionerRole;
    const persistedSchedule = txResult.entry?.find((e) => e.resource?.resourceType === 'Schedule')
      ?.resource as Schedule;
    assert(persistedPractitioner?.id);
    assert(persistedLocation?.id);
    assert(persistedPR?.id);
    assert(persistedSchedule?.id);

    try {
      const prSlug = `pr-${persistedPR.id}`;
      // Provider-slug isn't strictly needed by get-schedule (we'll use the
      // PR's id-as-slug via the existing slug mechanism would require an
      // identifier — for the integration test we look up the PR's vended
      // slots by directly searching for them). Instead, vend slots via
      // the PR's own slug pattern.
      // For this test we'll bypass the slug lookup and directly construct
      // the vended slot via createSlotParamsFromSlotAndOptions using a
      // hand-built SlotListItem-shaped Slot — the goal is to exercise
      // create-slot + create-appointment, not get-schedule's slug
      // resolution path (which has its own coverage).
      void prSlug;

      // Build a vended-Slot-equivalent: a Slot resource pointing at the
      // Schedule with the slot-at-location extension stamped (matching
      // what makeSlotListItems would produce for this PR + Location).
      // Use the writer helper so the URL can't drift from what the reader
      // (getSlotAtLocationId) expects — the previous hardcoded URL didn't
      // match the constant and the assertion below was silently failing.
      const slotStartISO = timeNow.plus({ hours: 12 }).toISO()!;
      const fauxVendedSlot: Slot = {
        resourceType: 'Slot',
        id: `${persistedSchedule.id}|${slotStartISO}`,
        status: 'free',
        start: slotStartISO,
        end: timeNow.plus({ hours: 12, minutes: 15 }).toISO()!,
        schedule: { reference: `Schedule/${persistedSchedule.id}` },
        extension: [makeSlotAtLocationExtensionEntry(persistedLocation.id)],
      };

      // Sanity: the reader sees the extension on the faux vended slot.
      expect(getSlotAtLocationId(fauxVendedSlot)).toBe(persistedLocation.id);

      // createSlotParamsFromSlotAndOptions should forward the extension as
      // atLocationId on the resulting CreateSlotParams.
      const createSlotParams = createSlotParamsFromSlotAndOptions(fauxVendedSlot, {
        status: 'busy-tentative',
        originalBookingUrl: `pr-integration?bookingOn=${prSlug}`,
      });
      expect(createSlotParams.atLocationId).toBe(persistedLocation.id);

      // create-slot zambda should accept atLocationId, validate it against
      // PR.location[], and persist the extension on the resulting Slot.
      const persistedSlot = (
        await oystehr.zambda.executePublic({
          id: 'create-slot',
          ...createSlotParams,
        })
      ).output as Slot;
      assert(persistedSlot?.id);
      expect(persistedSlot.resourceType).toBe('Slot');
      expect(getSlotAtLocationId(persistedSlot)).toBe(persistedLocation.id);

      // create-appointment should resolve bookingLocation. Under the
      // precedence rules, a single-location PR-actored slot uses the
      // actor's location (step 2 of resolveBookingLocationId), not the
      // extension. Either way, the resolved Location id must match.
      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
        firstName: newPatient.name![0]!.given![0],
        lastName: newPatient.name![0]!.family,
        sex: 'female',
        dateOfBirth: newPatient.birthDate,
        newPatient: true,
        phoneNumber: '+12027139680',
        email: 'integration-pr-actor@example.com',
        tags: [tag],
      };
      const createApptInput: CreateAppointmentInputParams = {
        patient: patientInfo,
        slotId: persistedSlot.id,
      };
      const createApptResponse = (
        await oystehr.zambda.execute({
          id: 'create-appointment',
          ...createApptInput,
        })
      ).output as CreateAppointmentResponse;
      assert(createApptResponse?.appointmentId);

      const { appointment, encounter } = createApptResponse.resources;
      // Encounter.location should carry the resolved Location.
      const encounterLocationRefs = (encounter.location ?? []).map((l) => l.location?.reference).filter(Boolean);
      expect(encounterLocationRefs).toContain(`Location/${persistedLocation.id}`);
      // Appointment.participant should include the Location and the
      // attending Practitioner (resolved from the PR actor).
      const appointmentParticipantRefs = (appointment.participant ?? [])
        .map((p) => p.actor?.reference)
        .filter((r): r is string => !!r);
      expect(appointmentParticipantRefs).toContain(`Location/${persistedLocation.id}`);
      expect(appointmentParticipantRefs).toContain(`Practitioner/${persistedPractitioner.id}`);
    } finally {
      // cleanupTestScheduleResources picks up Schedule + actor, but its
      // _include doesn't iterate to Practitioner / Location through the
      // PR. Explicitly delete the fixture resources here.
      const deletes: BatchInputDeleteRequest[] = [
        { method: 'DELETE', url: `Practitioner/${persistedPractitioner.id}` },
        { method: 'DELETE', url: `Location/${persistedLocation.id}` },
        { method: 'DELETE', url: `PractitionerRole/${persistedPR.id}` },
        { method: 'DELETE', url: `Schedule/${persistedSchedule.id}` },
      ];
      try {
        await oystehr.fhir.batch({ requests: deletes });
      } catch (e) {
        console.error('Failed to clean up PR-actored fixture; afterAll process-tag sweep will retry:', e);
      }
    }
  });

  // this is flaky and can fail based on time of day for the CI server
  test.skip('create an appointment at 1130PM eastern and ensure that the appointment created is for the correct calendar day.', async () => {
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
      isWalkin: false,
      isPostTelemed: false,
    });

    console.log('createdSlotResponse ', createdSlotResponse);

    const { appointment } = await createAppointmentAndValidate({
      timezone,
      patientInfo,
      patient: undefined,
      slot: createdSlotResponse,
    });

    console.log('appointment ', appointment);

    expect(appointment).toBeDefined();
    expect(appointment.start?.charAt(appointment.start.length - 1)).toEqual('Z'); // should be in UTC
    const appointmentDateTime = DateTime.fromISO(appointment.start!);
    const slotDateTime = DateTime.fromISO(createdSlotResponse.start!);
    expect(slotDateTime.toISO()).toEqual(appointmentDateTime.toISO()); // Appointment should have the same time as the Slot
    expect(appointmentDateTime.hour).toEqual(23);
    expect(appointmentDateTime.day).toEqual(DateTime.now().day); // Appointment should be for today, not tomorrow.
  });
});
