import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-create-in-house-lab-order-resources: FHIR-backed read scoped to a seeded encounter/patient
// (no orders exist yet, so an empty-but-well-formed result is returned).
describe('get-create-in-house-lab-order-resources integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'get-create-in-house-lab-order-resources.test.ts',
      M2MClientMockType.provider
    );
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a payload', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-create-in-house-lab-order-resources',
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });
});
