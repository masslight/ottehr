import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-patient-visit-history: returns the visit history list for a
// patient (the seed patient has the one seeded appointment/encounter).
describe('get-patient-visit-history integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-patient-visit-history.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the visit history for a patient', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-patient-visit-history',
      patientId: base.patient.id,
    });
    expect(response.output).toBeDefined();
  });
});
