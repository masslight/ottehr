import Oystehr from '@oystehr/sdk';
import { Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for walkin-check-availability: given a schedule id, returns whether
// walk-in is currently available plus the schedule's open/close window.
describe('walkin-check-availability integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let scheduleId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('walkin-check-availability.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const locationRef = base.appointment.participant
      ?.map((p) => p.actor?.reference)
      .find((ref) => ref?.startsWith('Location/'));
    // 24/7 open schedule so walk-in availability resolves deterministically.
    const schedule = await oystehrAdmin.fhir.create<Schedule>({
      ...makeSchedule({ scheduleObject: buildSimpleScheduleExt(), processId: setup.processId, locationRef }),
      id: undefined,
    });
    scheduleId = schedule.id;
  }, 60_000);

  afterAll(async () => {
    if (scheduleId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('returns walk-in availability for a schedule', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'walkin-check-availability',
      scheduleId,
    });
    expect(response.output).toBeDefined();
  });
});
