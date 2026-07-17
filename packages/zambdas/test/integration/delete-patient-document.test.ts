import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-patient-document: delete a patient DocumentReference.
// A DocumentReference is created in setup, then deleted via the zambda.
describe('delete-patient-document integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let documentRefId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-patient-document.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const docRef = await oystehrAdmin.fhir.create<DocumentReference>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'DocumentReference',
          status: 'current',
          subject: { reference: `Patient/${base.patient.id}` },
          content: [{ attachment: { contentType: 'application/pdf', title: 'IT doc' } }],
        } as DocumentReference,
        setup.processId
      ) as DocumentReference
    );
    documentRefId = docRef.id!;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: documentRefId });
    } catch {
      // best-effort (likely already deleted by the zambda)
    }
    await cleanup();
  });

  it('deletes a patient document', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'delete-patient-document', documentRefId });
    expect(response.output).toBeDefined();
  });
});
