import Oystehr from '@oystehr/sdk';
import { Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, ServiceMode } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for create-slot: given a schedule, a future start time and a service
// modality, persists a Slot on that schedule and returns it.
describe('create-slot integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let scheduleId: string | undefined;
  let createdSlotId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-slot.test.ts', M2MClientMockType.patient);
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
    if (createdSlotId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Slot', id: createdSlotId }).catch(() => undefined);
    }
    if (scheduleId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('creates a slot on the schedule', async () => {
    const startISO = DateTime.now().plus({ days: 1 }).startOf('hour').toISO()!;
    const response = await oystehrPatient.zambda.executePublic({
      id: 'create-slot',
      scheduleId,
      startISO,
      lengthInMinutes: 15,
      serviceModality: ServiceMode['in-person'],
    });
    const slot = response.output as Slot;
    expect(slot).toBeDefined();
    expect(slot.resourceType).toBe('Slot');
    createdSlotId = slot.id;
  });
});
