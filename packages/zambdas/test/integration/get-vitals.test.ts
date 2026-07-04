import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-vitals: returns the current vitals map for an encounter
// (empty when no vitals Observations exist yet, which is the case for the seed).
describe('get-vitals integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-vitals.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the current vitals for an encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-vitals',
      encounterId: base.encounter.id,
      currentOrHistorical: 'current',
    });
    expect(response.output).toBeDefined();
  });
});
