import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-chart-data: returns the chart payload for an encounter.
// A freshly-seeded encounter has an empty chart but a well-formed response.
describe('get-chart-data integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-chart-data.integration.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns chart data for an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-chart-data',
      encounterId: base.encounter.id,
    });
    const output = response.output as { patientId?: string };
    expect(output).toBeDefined();
    expect(output.patientId).toBe(base.patient.id);
  });
});
