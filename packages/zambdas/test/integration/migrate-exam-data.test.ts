import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for migrate-exam-data: run the exam-data migration for an
// encounter. A freshly-seeded encounter has no exam data, so the migration is a
// well-formed no-op.
describe('migrate-exam-data integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('migrate-exam-data.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('migrates exam data for an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'migrate-exam-data',
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });
});
