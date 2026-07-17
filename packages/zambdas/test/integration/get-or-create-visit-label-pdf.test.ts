import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-or-create-visit-label-pdf: generates (or returns) the visit
// label PDF for an encounter, storing it to Oystehr z3 + a DocumentReference.
// FHIR + z3 only. The created DocumentReference is removed afterward.
describe('get-or-create-visit-label-pdf integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let createdDocRefId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-or-create-visit-label-pdf.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (createdDocRefId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: createdDocRefId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('returns the visit label pdf for an encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-or-create-visit-label-pdf',
      encounterId: base.encounter.id,
    });
    const labels = response.output as { documentReference?: DocumentReference; presignedURL?: string }[];
    expect(Array.isArray(labels)).toBe(true);
    expect(labels[0]?.presignedURL).toBeDefined();
    createdDocRefId = labels[0]?.documentReference?.id;
  });
});
