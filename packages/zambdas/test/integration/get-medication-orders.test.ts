import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-medication-orders: query medication orders by encounterId.
// A freshly-seeded encounter has no nursing orders, so the happy path returns
// an empty (but well-formed) list.
describe('get-medication-orders integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-medication-orders.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns medication orders for an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-medication-orders',
      searchBy: { field: 'encounterId', value: base.encounter.id },
    });
    expect(response.output).toBeDefined();
  });
});
