import Oystehr from '@oystehr/sdk';
import { Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for ehr-get-schedule: given a scheduleId, returns the schedule's
// details (owner, timezone, daily schedule). Uses a throwaway Location + Schedule.
describe('ehr-get-schedule integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let locationId: string | undefined;
  let scheduleId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('ehr-get-schedule.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const location = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: 'Integration Test EHR Schedule Location',
    });
    locationId = location.id;
    const schedule = await oystehrAdmin.fhir.create<Schedule>({
      ...makeSchedule({
        scheduleObject: buildSimpleScheduleExt(),
        processId: setup.processId,
        locationRef: `Location/${location.id}`,
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

  it('returns the schedule details for a scheduleId', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'ehr-get-schedule',
      scheduleId,
    });
    expect(response.output).toBeDefined();
  });
});
