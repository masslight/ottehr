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

// Happy path for get-appointment-details: returns the appointment summary (start,
// location, visit type, available reschedule slots) for a given appointment id.
// The endpoint resolves the schedule owner from the appointment's Location actor,
// so the seed Location needs a Schedule with a valid scheduling extension.
describe('get-appointment-details integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let scheduleId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-appointment-details.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const locationRef = base.appointment.participant
      ?.map((p) => p.actor?.reference)
      .find((ref) => ref?.startsWith('Location/'));
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

  it('returns the appointment details', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-appointment-details',
      appointmentID: base.appointment.id,
    });
    expect(response.output).toBeDefined();
    expect((response.output as { appointment?: unknown }).appointment).toBeDefined();
  });
});
