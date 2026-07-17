import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType, SLUG_SYSTEM } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, makeSchedule } from '../helpers/testScheduleUtils';

// Happy path for get-schedule: given an owner slug + schedule type, resolves the
// owner (a Location here) and its Schedule, returning the bookable slot data. The
// owner needs a slug identifier and an attached Schedule with a valid extension.
describe('get-schedule integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let locationId: string | undefined;
  let scheduleId: string | undefined;
  let slug: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-schedule.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    slug = `it-${randomUUID().slice(0, 8)}`;
    const location = await oystehrAdmin.fhir.create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: 'Integration Test Schedule Location',
      identifier: [{ system: SLUG_SYSTEM, value: slug }],
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

  it('returns the schedule for an owner slug', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-schedule',
      slug,
      scheduleType: 'location',
    });
    expect(response.output).toBeDefined();
  });
});
