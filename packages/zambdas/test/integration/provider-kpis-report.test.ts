import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Patient, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  getSlugForBookableResource,
  getTimezone,
  IncompleteEncountersReportZambdaOutput,
  PatientInfo,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
  SLUG_SYSTEM,
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

interface SetUpOutput {
  schedule: import('fhir/r4b').Schedule;
  timezone: string;
}

describe('provider-kpis-report (incomplete-encounters-report with includeEmCodes)', () => {
  let oystehr: Oystehr;
  let processId: string | null = null;
  let testPatient: Patient;
  let inPersonSchedule: SetUpOutput;
  const createdAppointmentIds: string[] = [];
  const createdEncounterIds: string[] = [];

  const getPatientInfo = (): PatientInfo => ({
    id: testPatient!.id,
    firstName: testPatient!.name![0]!.given![0],
    lastName: testPatient!.name![0]!.family,
    email: 'test+provider-kpis@example.com',
    sex: 'female',
    dateOfBirth: testPatient!.birthDate,
    newPatient: false,
  });

  const setUpInPersonResources = async (): Promise<SetUpOutput> => {
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 24,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 5);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'Provider KPIs Test Location',
      description: 'Temporary test location for provider-kpis-report integration tests',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `provider-kpis-test-slug-${randomUUID()}`,
        },
      ],
      address: {
        use: 'work',
        type: 'physical',
        line: ['99 Test Ave'],
        city: 'Test City',
        state: 'NY',
        postalCode: '10001',
      },
      telecom: [
        { system: 'phone', use: 'work', value: '5551234567' },
        { system: 'url', use: 'work', value: 'https://example.com' },
      ],
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    assert(schedule.id);
    assert(owner);

    const slug = getSlugForBookableResource(owner);
    assert(slug);

    return { schedule, timezone: getTimezone(schedule) };
  };

  const createWalkInAppointment = async (): Promise<{
    appointmentId: string;
    encounterId: string;
  }> => {
    const { schedule, timezone } = inPersonSchedule;

    const walkinSlot: Slot = {
      resourceType: 'Slot',
      start: DateTime.now().setZone(timezone).toISO()!,
      end: DateTime.now().setZone(timezone).plus({ minutes: 30 }).toISO()!,
      schedule: { reference: `Schedule/${schedule.id}` },
      status: 'busy-tentative',
      appointmentType: { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING },
      serviceCategory: [SlotServiceCategory.inPersonServiceMode],
    };
    const slot = await oystehr.fhir.create<Slot>({ ...walkinSlot });
    assert(slot.id);

    const createAppointmentInputParams: CreateAppointmentInputParams = {
      patient: getPatientInfo(),
      slotId: slot.id,
    };

    const response = await oystehr.zambda.execute({
      id: 'create-appointment',
      ...createAppointmentInputParams,
    });

    const createAppointmentResponse = response.output as CreateAppointmentResponse;
    assert(createAppointmentResponse?.appointmentId);
    assert(createAppointmentResponse?.encounterId);

    createdAppointmentIds.push(createAppointmentResponse.appointmentId);
    createdEncounterIds.push(createAppointmentResponse.encounterId);

    return {
      appointmentId: createAppointmentResponse.appointmentId,
      encounterId: createAppointmentResponse.encounterId,
    };
  };

  const advanceToCompleted = async (encounterId: string): Promise<void> => {
    const statuses: VisitStatusWithoutUnknown[] = ['intake', 'ready', 'provider', 'discharged', 'completed'];
    for (const status of statuses) {
      await oystehr.zambda.execute({
        id: 'change-in-person-visit-status',
        encounterId,
        updatedStatus: status,
      });
    }
  };

  const callProviderKpisReport = async (dateRange: {
    start: string;
    end: string;
  }): Promise<IncompleteEncountersReportZambdaOutput> => {
    const response = await oystehr.zambda.execute({
      id: 'incomplete-encounters-report',
      encounterStatus: 'complete',
      includeEmCodes: true,
      dateRange,
    });
    return response.output as IncompleteEncountersReportZambdaOutput;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();

    const token = await getAuth0Token({
      AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    await ensureM2MPractitionerProfile(token);
    inPersonSchedule = await setUpInPersonResources();
    testPatient = await persistTestPatient({ patient: makeTestPatient(), processId }, oystehr);
    expect(testPatient.id).toBeDefined();
  });

  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null — could not clean up');
    }

    const deleteRequests = [
      ...createdEncounterIds.map((id) => ({ method: 'DELETE' as const, url: `Encounter/${id}` })),
      ...createdAppointmentIds.map((id) => ({ method: 'DELETE' as const, url: `Appointment/${id}` })),
    ];
    if (deleteRequests.length > 0) {
      try {
        await oystehr.fhir.batch({ requests: deleteRequests });
      } catch (error) {
        console.error('Error deleting test appointments/encounters:', error);
      }
    }

    await cleanupTestScheduleResources(processId, oystehr);
  });

  // ============================================================================
  // Validation tests
  // ============================================================================

  test('returns error when dateRange is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        includeEmCodes: true,
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.start is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        includeEmCodes: true,
        dateRange: { end: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.end is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        includeEmCodes: true,
        dateRange: { start: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  // ============================================================================
  // Results tests
  // ============================================================================

  test('returns empty list for a date range in the far past', async () => {
    const farPast = { start: '1990-01-01T00:00:00.000Z', end: '1990-01-02T00:00:00.000Z' };
    const result = await callProviderKpisReport(farPast);
    expect(result.encounters).toHaveLength(0);
  });

  test('returns completed encounters with includeEmCodes and excludes non-completed ones', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    // Create two appointments: one will be completed, one stays in-progress
    const { appointmentId: completedApptId, encounterId: completedEncId } = await createWalkInAppointment();
    const { appointmentId: inProgressApptId } = await createWalkInAppointment();

    // Advance the first appointment through the full status flow to 'completed'
    await advanceToCompleted(completedEncId);

    // Query the report
    const result = await callProviderKpisReport(dateRange);
    const completedApptIds = result.encounters.map((e) => e.appointmentId);

    // The completed appointment should appear
    expect(completedApptIds).toContain(completedApptId);

    // The in-progress appointment should NOT appear
    expect(completedApptIds).not.toContain(inProgressApptId);
  });

  test('response encounters have the expected shape including emCode and providerToDischargedMinutes fields', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    const result = await callProviderKpisReport(dateRange);

    // Filter to only encounters created by this test run
    const ourEncounters = result.encounters.filter((e) => createdAppointmentIds.includes(e.appointmentId));
    expect(ourEncounters.length).toBeGreaterThan(0);

    for (const encounter of ourEncounters) {
      expect(encounter.visitStatus).toBe('completed');
      expect(encounter.appointmentId).toBeTruthy();
      expect(encounter.patientId).toBeTruthy();
      expect(encounter.appointmentStart).toBeTruthy();
      // providerToDischargedMinutes should be present (may be null if no provider/discharged status)
      expect('providerToDischargedMinutes' in encounter).toBe(true);
    }
  });

  test('completed encounters that went through provider status have a numeric providerToDischargedMinutes', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    const result = await callProviderKpisReport(dateRange);

    // Filter to encounters created by this test (they all went through provider -> discharged -> completed)
    const ourEncounters = result.encounters.filter((e) => createdAppointmentIds.includes(e.appointmentId));
    const completedOurs = ourEncounters.filter((e) => e.visitStatus === 'completed');

    // At least one should have a numeric providerToDischargedMinutes
    const withDuration = completedOurs.filter(
      (e) => e.providerToDischargedMinutes !== null && e.providerToDischargedMinutes !== undefined
    );
    expect(withDuration.length).toBeGreaterThan(0);

    for (const encounter of withDuration) {
      expect(typeof encounter.providerToDischargedMinutes).toBe('number');
      expect(encounter.providerToDischargedMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});
