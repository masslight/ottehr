import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-patient-coverages: returns the billing coverage options for a
// patient (an empty list for the seed patient, who has no Coverage — still a valid
// 200 response). FHIR-only: searches Coverage in the billing workspace.
describe('get-patient-coverages integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-patient-coverages.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the coverage options for a patient', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-patient-coverages',
      patientId: base.patient.id,
    });
    expect(response.output).toBeDefined();
    expect((response.output as { coverages?: unknown[] }).coverages).toBeDefined();
  });
});
