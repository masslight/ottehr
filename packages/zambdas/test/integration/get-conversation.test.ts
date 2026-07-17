import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-conversation: returns the SMS/message conversation items for a patient (FHIR-backed).
// A freshly-seeded encounter has an empty chart but a well-formed response.
describe('get-conversation integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-conversation.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a conversation payload for a patient', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-conversation',
      patientId: base.patient.id,
      timezone: 'America/New_York',
    });
    expect(response.output).toBeDefined();
  });
});
