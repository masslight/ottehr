import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-vitals-for-list-of-encounters: returns vitals keyed by encounter.
// A freshly-seeded encounter has an empty chart but a well-formed response.
describe('get-vitals-for-list-of-encounters integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-vitals-for-list-of-encounters.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns vitals for a list of encounters', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-vitals-for-list-of-encounters',
      encounterIds: [base.encounter.id],
    });
    expect(response.output).toBeDefined();
  });
});
