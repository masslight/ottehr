import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-login-phone-numbers: returns the login phone numbers
// associated with a patient's account.
describe('get-login-phone-numbers integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-login-phone-numbers.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns login phone numbers for a patient', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-login-phone-numbers',
      patientId: base.patient.id,
    });
    const output = response.output as { phoneNumbers: unknown[] };
    expect(output).toBeDefined();
    expect(Array.isArray(output.phoneNumbers)).toBe(true);
  });
});
