import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-chart-data: returns the chart data for an encounter (mostly
// empty for the seed encounter, which carries no chart resources yet).
describe('get-chart-data integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-chart-data.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the chart data for an encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-chart-data',
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });
});
