import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Patient, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CompleteEncountersReportZambdaOutput,
  CreateAppointmentInputParams,
  CreateAppointmentResponse,
  getSlugForBookableResource,
  getTimezone,
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

describe('complete-encounters-report zambda', () => {
  let oystehr: Oystehr;
  let processId: string | null = null;
  let testPatient: Patient;
  let inPersonSchedule: SetUpOutput;

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

    return {
      appointmentId: createAppointmentResponse.appointmentId,
      encounterId: createAppointmentResponse.encounterId,
    };
  };

  /**
   * Advances a walk-in encounter through the required in-person status flow to reach 'completed'.
   * The status machine requires sequential transitions: arrived → intake → ready → provider → discharge → completed
   */
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

  const callCompleteEncountersReport = async (dateRange: {
    start: string;
    end: string;
  }): Promise<CompleteEncountersReportZambdaOutput> => {
    const response = await oystehr.zambda.execute({
      id: 'complete-encounters-report',
      dateRange,
    });
    return response.output as CompleteEncountersReportZambdaOutput;
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
    await cleanupTestScheduleResources(processId, oystehr);
  });

  // ============================================================================
  // Validation tests
  // ============================================================================

  test('returns error when dateRange is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'complete-encounters-report',
        // omit dateRange intentionally
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.start is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'complete-encounters-report',
        dateRange: { end: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.end is missing', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'complete-encounters-report',
        dateRange: { start: DateTime.now().toISO() },
      })
    ).rejects.toThrow();
  });

  test('returns error when dateRange.start is not a valid ISO date', async () => {
    await expect(
      oystehr.zambda.execute({
        id: 'complete-encounters-report',
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

  test('response encounters have the expected shape and visitStatus is "completed"', async () => {
    const today = DateTime.now().setZone('America/New_York');
    const dateRange = {
      start: today.startOf('day').toISO()!,
      end: today.endOf('day').toISO()!,
    };

    const result = await callCompleteEncountersReport(dateRange);

    // All returned encounters should have visitStatus === 'completed'
    for (const encounter of result.encounters) {
      expect(encounter.visitStatus).toBe('completed');
      expect(encounter.appointmentId).toBeTruthy();
      expect(encounter.patientId).toBeTruthy();
      expect(encounter.appointmentStart).toBeTruthy();
    }
  });
});
