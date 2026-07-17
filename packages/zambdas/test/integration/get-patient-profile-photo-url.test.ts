import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-patient-profile-photo-url: for the 'upload' action, returns
// the z3 image URL and a presigned upload URL for the patient's profile photo.
// Uses Oystehr Z3 presigning only (no third-party calls).
describe('get-patient-profile-photo-url integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-patient-profile-photo-url.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a presigned upload URL for the patient profile photo', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-patient-profile-photo-url',
      action: 'upload',
      patientId: base.patient.id,
    });
    expect(response.output).toBeDefined();
    expect((response.output as { presignedImageUrl?: string }).presignedImageUrl).toBeDefined();
  });
});
