import Oystehr from '@oystehr/sdk';
import { Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for get-slot-details: given a slotId, resolves the slot, its schedule,
// the schedule owner (Location), and returns the slot's display details. Needs a
// real Slot referencing a Schedule whose actor is the seed Location.
describe('get-slot-details integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let scheduleId: string | undefined;
  let slotId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-slot-details.test.ts', M2MClientMockType.patient);
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

    const start = DateTime.now().plus({ days: 1 }).startOf('hour');
    const slot = await oystehrAdmin.fhir.create<Slot>({
      resourceType: 'Slot',
      status: 'busy',
      schedule: { reference: `Schedule/${schedule.id}` },
      start: start.toISO()!,
      end: start.plus({ minutes: 15 }).toISO()!,
    });
    slotId = slot.id;
  }, 60_000);

  afterAll(async () => {
    if (slotId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Slot', id: slotId }).catch(() => undefined);
    }
    if (scheduleId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('returns the slot details', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-slot-details',
      slotId,
    });
    expect(response.output).toBeDefined();
    expect((response.output as { slotId?: string }).slotId).toBe(slotId);
  });
});
