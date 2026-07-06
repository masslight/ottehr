import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-appointments: given a search date, timezone, visit types
// and a provider filter, returns the appointments payload (empty list is a
// valid happy-path result for an arbitrary provider/day).
describe('get-appointments integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let practitionerId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-appointments.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns appointments for a provider on a given day', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      searchDateFrom: DateTime.now().toISODate(),
      searchDateTo: DateTime.now().toISODate(),
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in'],
      providerIds: [practitionerId],
    });
    expect(response.output).toBeDefined();
  });
});
