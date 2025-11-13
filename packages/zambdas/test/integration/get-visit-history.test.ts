import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Location, Patient, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  appointmentTypeForAppointment,
  checkEncounterIsVirtual,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  GetPatientVisitListInput,
  getScheduleExtension,
  getSlotIsPostTelemed,
  getSlotIsWalkin,
  getSlugForBookableResource,
  getTimezone,
  isPostTelemedAppointment,
  isTelemedAppointment,
  PatientInfo,
  PatientVisitListResponse,
  ScheduleOwnerFhirResource,
  ServiceMode,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
  SLUG_SYSTEM,
  TelemedCallStatuses,
  Timezone,
  TIMEZONES,
  VisitStatusWithoutUnknown,
} from 'utils';
import { assert, inject } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
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
  schedule: Schedule;
  patient: Patient;
  type: 'pre-booked' | 'walk-in';
  serviceMode: ServiceMode;
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

  assert(encounter);
  assert(encounter.id);
  // todo: should encounter status be 'arrived' for walkin virtual appointments to match the appointment status?
  // i think this is intended and helps with some intake logic particular to the virtual walkin flow
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

interface AppointmentAndMetadata {
  appointment: Appointment;
  metadata: {
    type: 'pre-booked' | 'walk-in';
    serviceMode: ServiceMode;
    startISO: string;
    timezone: Timezone;
    providerName?: string;
  };
}

describe('tests for getting the visit history for a patient', () => {
  let oystehr: Oystehr;
  let token = null;
  let processId: string | null = null;
  let inPersonSchedule: SetUpOutput;
  let virtualSchedule: SetUpOutput;
  let testPatient: Patient;
  const pastAppointments: AppointmentAndMetadata[] = [];

  const getPatientInfo = (): PatientInfo => ({
    id: testPatient!.id,
    firstName: testPatient!.name![0]!.given![0],
    lastName: testPatient!.name![0]!.family,
    email: 'okovalenko+coolPatient@masslight.com',
    sex: 'female',
    dateOfBirth: testPatient!.birthDate,
    newPatient: false,
  });

  const setUpInPersonResources = async (): Promise<SetUpOutput> => {
    expect(oystehr).toBeDefined();
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 24,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'Visit History In Person Test Location',
      description: 'We only just met but I will be gone soon',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `visit-history-in-person-test-slug-${randomUUID()}`,
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

  const setUpVirtualResources = async (): Promise<SetUpOutput> => {
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
      name: 'Visit History Virtual Test Location',
      description: 'We only just met but I will be gone soon',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `get-visit-history-virtual-loc-${randomUUID()}`,
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

  const createAppointmentAndValidate = async (
    input: CreateAppointmentInput
  ): Promise<ValidatedCreateAppointmentResponseOutput> => {
    const { patientInfo, patient, schedule, type, serviceMode } = input;
    const timezone = getTimezone(schedule);

    console.log('timezone for schedule:', timezone);

    let slot: Slot;

    if (type === 'walk-in') {
      const walkinSlot: Slot = {
        resourceType: 'Slot',
        start: DateTime.now().setZone(timezone).toISO()!,
        end: DateTime.now().setZone(timezone).plus({ minutes: 30 }).toISO()!,
        schedule: { reference: `Schedule/${schedule.id}` },
        status: 'busy-tentative',
        appointmentType: { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING },
        serviceCategory:
          serviceMode === ServiceMode.virtual
            ? [SlotServiceCategory.virtualServiceMode]
            : [SlotServiceCategory.inPersonServiceMode],
      };
      slot = await oystehr.fhir.create<Slot>({ ...walkinSlot });
    } else {
      const threeYearsAgo = DateTime.now().setZone(timezone).minus({ years: 3 }).toMillis();
      const nowMs = DateTime.now().setZone(timezone).toMillis();
      const startDate = DateTime.fromMillis(
        Math.floor(Math.random() * (nowMs - threeYearsAgo) + threeYearsAgo)
      ).setZone(timezone);

      assert(startDate.isValid);
      const endDate = startDate.plus({ minutes: 30 });
      assert(endDate.isValid);
      const start = startDate.toISO();
      assert(start);
      const end = endDate.toISO();
      assert(end);

      const testStart1 = DateTime.fromISO(start, { setZone: true });
      const testStart2 = DateTime.fromISO(start);

      const SLOT_TZs = [testStart1.zoneName, testStart2.zoneName];
      console.log('Slot TZs to investigate:', SLOT_TZs);

      const prebookSlot: Slot = {
        resourceType: 'Slot',
        start,
        end,
        schedule: { reference: `Schedule/${schedule.id}` },
        status: 'busy-tentative',
        serviceCategory:
          serviceMode === ServiceMode.virtual
            ? [SlotServiceCategory.virtualServiceMode]
            : [SlotServiceCategory.inPersonServiceMode],
      };
      slot = await oystehr.fhir.create<Slot>({ ...prebookSlot });
    }

    assert(slot.id);

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient: patientInfo,
      slotId: slot.id,
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

    return validated;
  };

  const getVisitHistory = async (
    input: Omit<GetPatientVisitListInput, 'patientId'>
  ): Promise<PatientVisitListResponse> => {
    const response: PatientVisitListResponse = (
      await oystehr.zambda.execute({
        id: 'get-patient-visit-history',
        patientId: testPatient.id!,
        ...input,
      })
    ).output as PatientVisitListResponse;
    return response;
  };

  const changeInPersonAppointmentStatus = async (
    encounterId: string,
    status: VisitStatusWithoutUnknown
  ): Promise<void> => {
    await oystehr.zambda.execute({
      id: 'change-in-person-visit-status',
      encounterId,
      updatedStatus: status,
    });
  };

  const changeVirtualAppointmentStatus = async (appointmentId: string, status: TelemedCallStatuses): Promise<void> => {
    /*export interface ChangeTelemedAppointmentStatusInput {
        appointmentId: string;
        newStatus: TelemedCallStatuses;
        secrets: Secrets | null;
      }*/
    await oystehr.zambda.execute({
      id: 'change-telemed-appointment-status',
      appointmentId,
      newStatus: status,
    });
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
    await ensureM2MPractitionerProfile(token);
    inPersonSchedule = await setUpInPersonResources();
    virtualSchedule = await setUpVirtualResources();
    testPatient = await persistTestPatient({ patient: makeTestPatient(), processId }, oystehr);
    expect(testPatient.id).toBeDefined();
  });

  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    await cleanupTestScheduleResources(processId, oystehr);
  });

  // this is flaky and can fail based on time of day for the CI server
  test('create appointment helper func works', async () => {
    const patientInfo = getPatientInfo();
    const { appointment: inPersonAppointmentPrebooked } = await createAppointmentAndValidate({
      patientInfo,
      patient: testPatient,
      schedule: inPersonSchedule.schedule,
      type: 'pre-booked',
      serviceMode: ServiceMode['in-person'],
    });
    expect(inPersonAppointmentPrebooked).toBeDefined();

    pastAppointments.push({
      appointment: inPersonAppointmentPrebooked,
      metadata: {
        type: 'pre-booked',
        serviceMode: ServiceMode['in-person'],
        startISO: inPersonAppointmentPrebooked.start!,
        timezone: inPersonSchedule.timezone,
      },
    });

    const { appointment: inPersonWalkin } = await createAppointmentAndValidate({
      patientInfo,
      patient: testPatient,
      schedule: inPersonSchedule.schedule,
      type: 'walk-in',
      serviceMode: ServiceMode['in-person'],
    });
    expect(inPersonWalkin).toBeDefined();

    pastAppointments.push({
      appointment: inPersonWalkin,
      metadata: {
        type: 'walk-in',
        serviceMode: ServiceMode['in-person'],
        startISO: inPersonWalkin.start!,
        timezone: inPersonSchedule.timezone,
      },
    });

    const { appointment: virtualAppointmentOnDemand } = await createAppointmentAndValidate({
      patientInfo,
      patient: testPatient,
      schedule: virtualSchedule.schedule,
      type: 'walk-in',
      serviceMode: ServiceMode.virtual,
    });
    expect(virtualAppointmentOnDemand).toBeDefined();
    pastAppointments.push({
      appointment: virtualAppointmentOnDemand,
      metadata: {
        type: 'walk-in',
        serviceMode: ServiceMode.virtual,
        startISO: virtualAppointmentOnDemand.start!,
        timezone: virtualSchedule.timezone,
      },
    });
    const { appointment: virtualAppointmentPrebook } = await createAppointmentAndValidate({
      patientInfo,
      patient: testPatient,
      schedule: virtualSchedule.schedule,
      type: 'pre-booked',
      serviceMode: ServiceMode.virtual,
    });
    expect(virtualAppointmentPrebook).toBeDefined();
    pastAppointments.push({
      appointment: virtualAppointmentPrebook,
      metadata: {
        type: 'pre-booked',
        serviceMode: ServiceMode.virtual,
        startISO: virtualAppointmentPrebook.start!,
        timezone: virtualSchedule.timezone,
      },
    });
  });
  test('get visit history returns all created appointments', async () => {
    const visitHistory = await getVisitHistory({});
    expect(visitHistory.visits.length).toEqual(pastAppointments.length);

    const sorted = pastAppointments.sort((a, b) => {
      const aStart = DateTime.fromISO(a.appointment.start!);
      const bStart = DateTime.fromISO(b.appointment.start!);
      return bStart.toMillis() - aStart.toMillis();
    });

    sorted.forEach(({ appointment, metadata }, idx) => {
      const matchingVisit = visitHistory.visits[idx];
      expect(matchingVisit).toBeDefined();
      const appointmentType = appointmentTypeForAppointment(appointment);
      expect(metadata.timezone).toBeDefined();
      expect(metadata.timezone).toBe(TIMEZONES[0]);
      expect(matchingVisit?.dateTime).toEqual(DateTime.fromISO(metadata.startISO, { zone: metadata.timezone }).toISO());
      if (metadata.type === 'walk-in') {
        expect(appointmentType).toEqual('walk-in');
      } else if (metadata.type === 'pre-booked' && metadata.serviceMode === ServiceMode.virtual) {
        expect(appointmentType).toEqual('pre-booked');
      } else if (metadata.type === 'pre-booked' && metadata.serviceMode === ServiceMode['in-person']) {
        expect(appointmentType).toEqual('pre-booked');
      }
      const { serviceMode } = metadata;
      console.log('serviceMode for appointment:', serviceMode, matchingVisit?.serviceMode);
      expect(matchingVisit?.serviceMode).toEqual(serviceMode);
      const serviceModeFromAppointment = isTelemedAppointment(appointment)
        ? ServiceMode.virtual
        : ServiceMode['in-person'];
      expect(matchingVisit?.serviceMode).toEqual(serviceModeFromAppointment);
    });
  });
  test('sort param works as expected', async () => {
    const [visitHistory, visitHistoryBackwards] = await Promise.all([
      getVisitHistory({ sortDirection: 'desc' }),
      getVisitHistory({ sortDirection: 'asc' }),
    ]);
    expect(visitHistory.visits.length).toEqual(pastAppointments.length);

    const sorted = pastAppointments.sort((a, b) => {
      const aStart = DateTime.fromISO(a.appointment.start!);
      const bStart = DateTime.fromISO(b.appointment.start!);
      return bStart.toMillis() - aStart.toMillis();
    });

    sorted.forEach(({ appointment }, idx) => {
      const matchingVisit = visitHistory.visits[idx];
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit.appointmentId).toEqual(appointment.id);
    });

    const reversedSorted = [...sorted].reverse();
    reversedSorted.forEach(({ appointment }, idx) => {
      const matchingVisit = visitHistoryBackwards.visits[idx];
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit.appointmentId).toEqual(appointment.id);
    });
  });

  test('sort param works as expected', async () => {
    const [visitHistory, visitHistoryBackwards] = await Promise.all([
      getVisitHistory({ sortDirection: 'desc' }),
      getVisitHistory({ sortDirection: 'asc' }),
    ]);
    expect(visitHistory.visits.length).toEqual(pastAppointments.length);

    const sorted = pastAppointments.sort((a, b) => {
      const aStart = DateTime.fromISO(a.appointment.start!);
      const bStart = DateTime.fromISO(b.appointment.start!);
      return bStart.toMillis() - aStart.toMillis();
    });

    sorted.forEach(({ appointment }, idx) => {
      const matchingVisit = visitHistory.visits[idx];
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit.appointmentId).toEqual(appointment.id);
    });

    const reversedSorted = [...sorted].reverse();
    reversedSorted.forEach(({ appointment }, idx) => {
      const matchingVisit = visitHistoryBackwards.visits[idx];
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit.appointmentId).toEqual(appointment.id);
    });
  });

  test('filter by service mode works as expected', async () => {
    const [inPersonVisits, virtualVisits] = await Promise.all([
      getVisitHistory({ serviceMode: ServiceMode['in-person'] }),
      getVisitHistory({ serviceMode: ServiceMode.virtual }),
    ]);

    const inPersonAppointments = pastAppointments.filter(
      ({ metadata }) => metadata.serviceMode === ServiceMode['in-person']
    );
    const virtualAppointments = pastAppointments.filter(({ metadata }) => metadata.serviceMode === ServiceMode.virtual);

    expect(inPersonVisits.visits.length).toEqual(inPersonAppointments.length);
    expect(virtualVisits.visits.length).toEqual(virtualAppointments.length);

    inPersonAppointments.forEach(({ appointment }) => {
      const matchingVisit = inPersonVisits.visits.find((visit) => visit.appointmentId === appointment.id);
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit?.serviceMode).toEqual(ServiceMode['in-person']);
    });

    virtualAppointments.forEach(({ appointment }) => {
      const matchingVisit = virtualVisits.visits.find((visit) => visit.appointmentId === appointment.id);
      expect(matchingVisit).toBeDefined();
      expect(matchingVisit?.serviceMode).toEqual(ServiceMode.virtual);
    });
  });

  test('filter by date range works as expected', async () => {
    const allDates = pastAppointments.map(({ metadata }) =>
      DateTime.fromISO(metadata.startISO, { zone: metadata.timezone })
    );
    const sortedDates = allDates.sort((a, b) => a.toMillis() - b.toMillis());
    const fromDate = sortedDates[1];
    const toDate = sortedDates[sortedDates.length - 2];

    const visitHistory = await getVisitHistory({
      from: fromDate.toISO()!,
      to: toDate.toISO()!,
    });

    const expectedAppointments = pastAppointments.filter(({ metadata }) => {
      const appointmentDate = DateTime.fromISO(metadata.startISO, { zone: metadata.timezone });
      return appointmentDate >= fromDate && appointmentDate <= toDate;
    });

    expect(visitHistory.visits.length).toEqual(expectedAppointments.length);

    expectedAppointments.forEach(({ appointment, metadata }) => {
      const matchingVisit = visitHistory.visits.find((visit) => visit.appointmentId === appointment.id);
      expect(matchingVisit).toBeDefined();
      const appointmentDate = DateTime.fromISO(metadata.startISO, { zone: metadata.timezone });
      expect(DateTime.fromISO(matchingVisit!.dateTime!, { zone: metadata.timezone }).toISO()).toEqual(
        appointmentDate.toISO()
      );
    });
  });

  test('filter by appointment type works as expected', async () => {
    const [prebookedVisits, walkinVisits, allVisits] = await Promise.all([
      getVisitHistory({ type: ['pre-booked'] }),
      getVisitHistory({ type: ['walk-in'] }),
      getVisitHistory({ type: ['pre-booked', 'walk-in'] }),
    ]);

    const prebookedAppointments = pastAppointments.filter(({ metadata }) => metadata.type === 'pre-booked');
    const walkinAppointments = pastAppointments.filter(({ metadata }) => metadata.type === 'walk-in');

    expect(prebookedVisits.visits.length).toEqual(prebookedAppointments.length);
    expect(walkinVisits.visits.length).toEqual(walkinAppointments.length);

    prebookedAppointments.forEach(({ appointment }) => {
      const matchingVisit = prebookedVisits.visits.find((visit) => visit.appointmentId === appointment.id);
      expect(matchingVisit).toBeDefined();
      const appointmentType = appointmentTypeForAppointment(appointment);
      expect(appointmentType).toEqual('pre-booked');
      expect(matchingVisit?.appointmentId).toEqual(appointment.id);
      expect(matchingVisit?.type).toEqual('pre-booked');
    });

    walkinAppointments.forEach(({ appointment }) => {
      const matchingVisit = walkinVisits.visits.find((visit) => visit.appointmentId === appointment.id);
      expect(matchingVisit).toBeDefined();
      const appointmentType = appointmentTypeForAppointment(appointment);
      expect(appointmentType).toEqual('walk-in');
      expect(matchingVisit?.appointmentId).toEqual(appointment.id);
      expect(matchingVisit?.type).toEqual('walk-in');
    });
    expect(allVisits.visits.length).toEqual(pastAppointments.length);
  });

  test('status filter works as expected for in-person visits', async () => {
    const allVisits = await getVisitHistory({ serviceMode: ServiceMode['in-person'] });
    expect(allVisits.visits.length).toBeGreaterThan(0);
    let index = 0;
    for (const visit of allVisits.visits) {
      const newStatus: VisitStatusWithoutUnknown = index === 0 ? 'cancelled' : 'completed';
      expect(visit.encounterId).toBeDefined();
      await changeInPersonAppointmentStatus(visit.encounterId!, newStatus);
      index++;
    }
    const [allVisitsCanceledAndCompleted, canceledVisits, completedVisits] = await Promise.all([
      getVisitHistory({ status: ['cancelled', 'completed'] }),
      getVisitHistory({ status: ['cancelled'] }),
      getVisitHistory({ status: ['completed'] }),
    ]);
    expect(allVisitsCanceledAndCompleted.visits.length).toEqual(index);
    expect(canceledVisits.visits.length).toEqual(1);
    expect(completedVisits.visits.length).toEqual(1);
    canceledVisits.visits.forEach((visit) => {
      expect(visit.status).toEqual('cancelled');
    });
    completedVisits.visits.forEach((visit) => {
      expect(visit.status).toEqual('completed');
    });
  });

  // updating virtual appointment status throws an error right now when Oystehr.user.me() is called in the zambda
  // skipping this test for now until that is resolved
  // also not sure how long for this world this filter is
  test.skip('status filter works as expected for virtual visits', async () => {
    const allVisits = await getVisitHistory({ serviceMode: ServiceMode.virtual });
    expect(allVisits.visits.length).toBeGreaterThan(0);
    let index = 0;
    for (const visit of allVisits.visits) {
      const newStatus = index === 0 ? 'on-video' : 'complete';
      expect(visit.encounterId).toBeDefined();
      await changeVirtualAppointmentStatus(visit.appointmentId, newStatus);
      index++;
    }
    const [allVisitsInProgressOrComplete, completedVisits, inProgressVisits] = await Promise.all([
      getVisitHistory({ status: ['on-video', 'complete'] }),
      getVisitHistory({ status: ['complete'] }),
      getVisitHistory({ status: ['on-video'] }),
    ]);
    expect(allVisitsInProgressOrComplete.visits.length).toEqual(index);
    expect(inProgressVisits.visits.length).toEqual(1);
    expect(completedVisits.visits.length).toEqual(1);
    inProgressVisits.visits.forEach((visit) => {
      expect(visit.status).toEqual('on-video');
    });
    completedVisits.visits.forEach((visit) => {
      expect(visit.status).toEqual('complete');
    });
  });

  describe('catching input errors', () => {
    test.concurrent('invalid date range throws error', async () => {
      const fromDate = DateTime.now().toISO()!;
      const toDate = DateTime.now().minus({ days: 1 }).toISO()!;
      await expect(
        getVisitHistory({
          from: fromDate,
          to: toDate,
        })
      ).rejects.toThrow('The "from" date must be earlier than the "to" date.');
      await expect(
        getVisitHistory({
          from: 'May 30th, 2023',
        })
      ).rejects.toThrow('"from" must be a valid ISO date string.');
      await expect(
        getVisitHistory({
          to: '4th of July, 1776',
        })
      ).rejects.toThrow('"to" must be a valid ISO date string.');
    });
    test.concurrent('invalid "from" date range throws error', async () => {
      await expect(
        getVisitHistory({
          from: 'May 30th, 2023',
        })
      ).rejects.toThrow('"from" must be a valid ISO date string.');
    });
    test.concurrent('invalid "to" date throws error', async () => {
      await expect(
        getVisitHistory({
          to: '4th of July, 1776',
        })
      ).rejects.toThrow('"to" must be a valid ISO date string.');
    });
    test.concurrent('invalid serviceMode throws error', async () => {
      await expect(
        getVisitHistory({
          serviceMode: 'invalid-service-mode' as any,
        })
      ).rejects.toThrow('"serviceMode" must be one of in-person or virtual.');
    });
    test.concurrent('invalid type throws error', async () => {
      await expect(
        getVisitHistory({
          type: 'drop-on-by' as any,
        })
      ).rejects.toThrow('"type" must be an array of walk-in, pre-booked, post-telemed.');
    });
    test.concurrent('invalid status throws error', async () => {
      await expect(
        getVisitHistory({
          status: 'fubar' as any,
        })
      ).rejects.toThrow('"status" must be an array of strings.');
    });
    test.concurrent('invalid sortDirection', async () => {
      await expect(
        getVisitHistory({
          sortDirection: 'sideways' as any,
        })
      ).rejects.toThrow('"sortDirection" must be either "asc" or "desc".');
    });
  });
  describe('follow up visits', () => {
    let visitHistoryAfterFollowups: PatientVisitListResponse;
    beforeAll(async () => {
      const inPersonVisits = pastAppointments.filter(
        ({ metadata }) => metadata.serviceMode === ServiceMode['in-person']
      );
      const visitHistory = await getVisitHistory({ serviceMode: ServiceMode['in-person'] });
      for (const { appointment } of inPersonVisits) {
        const initialVisit = visitHistory.visits.find((visit) => visit.appointmentId === appointment.id);
        await oystehr.zambda.execute({
          id: 'save-followup-encounter',
          encounterDetails: {
            patientId: testPatient.id!,
            followupType: 'Follow-up Encounter',
            start: DateTime.now().setZone(inPersonSchedule.timezone).toISO()!,
            resolved: false,
            initialEncounterID: initialVisit?.encounterId,
            appointmentId: appointment.id!,
          },
        });
      }
      visitHistoryAfterFollowups = await getVisitHistory({});
    });
    test.only('follow up encounters are linked in visit history', async () => {
      const inPersonVisits = pastAppointments.filter(
        ({ metadata }) => metadata.serviceMode === ServiceMode['in-person']
      );
      for (const { appointment } of inPersonVisits) {
        const visit = visitHistoryAfterFollowups.visits.find((v) => v.appointmentId === appointment.id);
        expect(visit).toBeDefined();
        expect(visit?.followUps).toBeDefined();
        expect(visit?.followUps?.length).toBe(1);
        assert(visit?.followUps);
        const followUpVisit = visit.followUps.find((fuv) => fuv.originalAppointmentId === appointment.id);
        expect(followUpVisit).toBeDefined();
        assert(followUpVisit);
        expect(followUpVisit.type).toEqual('Follow-up Encounter');
        expect(followUpVisit.dateTime).toBeDefined();
        const followUpDateTime = DateTime.fromISO(followUpVisit.dateTime!, { setZone: true });
        expect(followUpDateTime.isValid).toBe(true);
        expect(followUpDateTime.zone).toBe(inPersonSchedule.timezone);
        expect(followUpVisit.serviceMode).toBe(ServiceMode.virtual); // follow ups are always virtual
      }
    });
  });
});
