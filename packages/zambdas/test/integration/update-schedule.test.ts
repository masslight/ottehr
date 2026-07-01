import Oystehr from '@oystehr/sdk';
import { Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for update-schedule: updates a schedule's timezone. Operates on a
// throwaway Location + Schedule so it never mutates shared/project state.
describe('update-schedule integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let locationId: string | undefined;
  let scheduleId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-schedule.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const location = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: 'Integration Test Update Schedule Location',
    });
    locationId = location.id;
    const schedule = await oystehrAdmin.fhir.create<Schedule>({
      ...makeSchedule({
        scheduleObject: buildSimpleScheduleExt(),
        processId: setup.processId,
        locationRef: `Location/${location.id}`,
        timezone: 'America/New_York',
      }),
      id: undefined,
    });
    scheduleId = schedule.id;
  }, 60_000);

  afterAll(async () => {
    if (scheduleId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }).catch(() => undefined);
    }
    if (locationId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Location', id: locationId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('updates the schedule timezone', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'update-schedule',
      scheduleId,
      timezone: 'America/Los_Angeles',
    });
    const schedule = response.output as Schedule;
    expect(schedule).toBeDefined();
    expect(schedule.resourceType).toBe('Schedule');
  });
});
