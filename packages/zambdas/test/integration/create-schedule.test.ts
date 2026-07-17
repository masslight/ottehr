import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { DEFAULT_SCHEDULE_JSON } from '../helpers/testScheduleUtils';

// Happy path for create-schedule: create a FHIR Schedule owned by a (throwaway)
// Location from a schedule-availability config. The created Schedule + Location
// are removed afterwards.
describe('create-schedule integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let locationId: string;
  let scheduleId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-schedule.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const location = await oystehrAdmin.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: `Sched Owner ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Location
    );
    locationId = location.id!;
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (scheduleId ? oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }) : undefined),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Location', id: locationId }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a schedule for a location owner', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-schedule',
      ownerId: locationId,
      ownerType: 'Location',
      scheduleId: randomUUID(),
      timezone: 'America/New_York',
      schedule: DEFAULT_SCHEDULE_JSON,
    });
    const output = response.output as Schedule;
    expect(output).toBeDefined();
    expect(output.resourceType).toBe('Schedule');
    scheduleId = output.id;
  });
});
