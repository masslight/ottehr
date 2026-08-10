import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { INTEGRATION_TEST_TAG_SYSTEM } from 'utils/lib/utils/e2eCleanup';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// toggle-schedule-active flips a single Schedule's active flag — deactivating
// drops just that schedule from booking, leaving its owner (and any other
// schedules the owner has) intact.
describe('toggle-schedule-active', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const createdSchedules: string[] = [];
  const createdLocations: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('toggle-schedule-active.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdSchedules) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id });
      } catch {
        // best-effort
      }
    }
    for (const id of createdLocations) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Location', id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  const tag = (): { system: string; code: string } => ({
    system: INTEGRATION_TEST_TAG_SYSTEM,
    code: `DELETE_ME-${processId}`,
  });

  const makeSchedule = async (): Promise<Schedule> => {
    const loc = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `TSA Loc ${randomUUID().slice(0, 8)}`,
      meta: { tag: [tag()] },
    });
    assert(loc.id);
    createdLocations.push(loc.id);

    const schedule = await oystehrAdmin.fhir.create<Schedule>({
      resourceType: 'Schedule',
      active: true,
      actor: [{ reference: `Location/${loc.id}` }],
      meta: { tag: [tag()] },
    });
    assert(schedule.id);
    createdSchedules.push(schedule.id);
    return schedule;
  };

  const readActive = async (id: string): Promise<boolean | undefined> =>
    (await oystehrAdmin.fhir.get<Schedule>({ resourceType: 'Schedule', id })).active;

  it('deactivates then reactivates a schedule', async () => {
    const schedule = await makeSchedule();

    await oystehrZambdas.zambda.execute({ id: 'toggle-schedule-active', scheduleId: schedule.id, active: false });
    expect(await readActive(schedule.id!)).toBe(false);

    await oystehrZambdas.zambda.execute({ id: 'toggle-schedule-active', scheduleId: schedule.id, active: true });
    expect(await readActive(schedule.id!)).toBe(true);
  });

  it('rejects a non-existent schedule', async () => {
    await expect(
      oystehrZambdas.zambda.execute({ id: 'toggle-schedule-active', scheduleId: randomUUID(), active: false })
    ).rejects.toThrow();
  });
});
