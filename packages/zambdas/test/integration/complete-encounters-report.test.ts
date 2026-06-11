import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Patient, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APIErrorCode,
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
import { createClinicalOystehrClient, getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
import {
  buildSimpleScheduleExt,
  cleanupTestScheduleResources,
  makeTestPatient,
  persistSchedule,
  persistTestPatient,
} from '../helpers/testScheduleUtils';

interface SetUpOutput {
  schedule: import('fhir/r4b').Schedule;
  timezone: string;
}

describe('complete-encounters-report zambda', () => {
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
    email: 'test+complete-encounters@example.com',
    sex: 'female',
    dateOfBirth: testPatient!.birthDate,
    newPatient: false,
  });

  const setUpInPersonResources = async (): Promise<SetUpOutput> => {
    // 24/7 open with 5 bookings/hour (slot-length-invariant).
    const adjustedScheduleJSON = buildSimpleScheduleExt({ prebookSlots: 5 });

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'Complete Encounters Test Location',
      description: 'Temporary test location for complete-encounters-report integration tests',
      identifier: [
        {
          system: SLUG_SYSTEM,
          value: `complete-encounters-test-slug-${randomUUID()}`,
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

  /**
   * Creates a walk-in appointment and returns the appointmentId and encounterId.
   */
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

  /**
   * Advances a walk-in encounter through the required in-person status flow to reach 'completed'.
   * The status machine requires sequential transitions: arrived → intake → ready → provider → discharge → completed
   *
   * Each transition is retried on a transient CONCURRENT_UPDATE (4024) error. The
   * change-in-person-visit-status zambda patches the Encounter with an optimistic lock (If-Match on
   * the version id). When this test fires the transitions back-to-back, an asynchronous backend
   * process (e.g. a subscription reacting to the previous status change) can bump the Encounter
   * version between the zambda's read and its conditional write, producing a 412 that surfaces as
   * CONCURRENT_UPDATE. The zambda re-reads the Encounter on every call, so re-issuing the transition
   * after a short backoff picks up the settled version and succeeds.
   */
  const advanceToCompleted = async (encounterId: string): Promise<void> => {
    const statuses: VisitStatusWithoutUnknown[] = ['intake', 'ready', 'provider', 'discharged', 'completed'];
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 1_000;

    for (const status of statuses) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await oystehr.zambda.execute({
            id: 'change-in-person-visit-status',
            encounterId,
            updatedStatus: status,
          });
          break;
        } catch (error: any) {
          const isConcurrentUpdate =
            error?.code === APIErrorCode.CONCURRENT_UPDATE || error?.message?.includes('modified during the operation');
          if (isConcurrentUpdate && attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
          throw error;
        }
      }
    }
  };

  const callCompleteEncountersReport = async (dateRange: {
    start: string;
    end: string;
  }): Promise<IncompleteEncountersReportZambdaOutput> => {
    const response = await oystehr.zambda.execute({
      id: 'incomplete-encounters-report',
      encounterStatus: 'complete',
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

    oystehr = createClinicalOystehrClient(
      token,
      {},
      {
        projectId: PROJECT_ID,
        services: { fhirApiUrl: FHIR_API, projectApiUrl: EXECUTE_ZAMBDA_URL, zambdaApiUrl: EXECUTE_ZAMBDA_URL },
      }
    );

    await ensureM2MPractitionerProfile(token);
    inPersonSchedule = await setUpInPersonResources();
    testPatient = await persistTestPatient({ patient: makeTestPatient(), processId }, oystehr);
    expect(testPatient.id).toBeDefined();
  });

  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null — could not clean up');
    }

    // Delete appointments and encounters created by this test
    // (cleanupTestScheduleResources does not clean up Appointments)
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
        // omit dateRange intentionally
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.start is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        dateRange: { end: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.end is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        dateRange: { start: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.start is not a valid ISO date', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'incomplete-encounters-report',
        encounterStatus: 'complete',
        dateRange: { start: 'not-a-date', end: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  // ============================================================================
  // Results tests
  // ============================================================================

  test('returns empty list for a date range in the far past', async () => {
    const farPast = { start: '1990-01-01T00:00:00.000Z', end: '1990-01-02T00:00:00.000Z' };
    const result = await callCompleteEncountersReport(farPast);
    expect(result.encounters).toHaveLength(0);
  });

  test('returns completed encounters and excludes non-completed ones', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    // Create two appointments: one will be completed, one stays in-progress (arrived)
    const { appointmentId: completedApptId, encounterId: completedEncId } = await createWalkInAppointment();
    const { appointmentId: inProgressApptId } = await createWalkInAppointment();

    // Advance the first appointment through the full status flow to 'completed'
    await advanceToCompleted(completedEncId);

    // Query the report for today's range
    const result = await callCompleteEncountersReport(dateRange);
    const completedApptIds = result.encounters.map((e) => e.appointmentId);

    // The completed appointment should appear
    expect(completedApptIds).toContain(completedApptId);

    // The in-progress appointment should NOT appear
    expect(completedApptIds).not.toContain(inProgressApptId);
  });

  test('response encounters created by this test have the expected shape and visitStatus is "completed"', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    const result = await callCompleteEncountersReport(dateRange);

    // Filter to only encounters created by this test run to avoid stale data from other tests
    const ourEncounters = result.encounters.filter((e) => createdAppointmentIds.includes(e.appointmentId));
    expect(ourEncounters.length).toBeGreaterThan(0);

    for (const encounter of ourEncounters) {
      expect(encounter.visitStatus).toBe('completed');
      expect(encounter.appointmentId).toBeTruthy();
      expect(encounter.patientId).toBeTruthy();
      expect(encounter.appointmentStart).toBeTruthy();
    }
  });
});
