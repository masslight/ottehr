import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for update-visit-files (and delete-visit-files as cleanup): attaches a
// photo-id file to the patient (creates a DocumentReference referencing a z3 URL —
// no file upload), then deletes it. Pairing the two avoids leaking the DocRef.
describe('update-visit-files integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  const docRefIdsForPatient = async (patientId: string): Promise<Set<string>> => {
    const docs = (
      await oystehrAdmin.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
    ).unbundle();
    return new Set(docs.map((d) => d.id!).filter(Boolean));
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-visit-files.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('attaches a visit file then deletes it', async () => {
    const patientId = base.patient.id!;
    const before = await docRefIdsForPatient(patientId);

    const updateResponse = await oystehrProvider.zambda.execute({
      id: 'update-visit-files',
      patientId,
      fileType: 'photo-id-front',
      attachment: {
        url: 'https://example.com/integration-test-photo-id.jpg',
        title: 'integration-test-photo-id.jpg',
        creation: new Date().toISOString(),
        contentType: 'image/jpeg',
      },
    });
    expect(updateResponse).toBeDefined();

    const after = await docRefIdsForPatient(patientId);
    const created = [...after].filter((id) => !before.has(id));
    expect(created.length).toBeGreaterThan(0);

    const deleteResponse = await oystehrProvider.zambda.execute({
      id: 'delete-visit-files',
      documentId: created[0],
      patientId,
    });
    expect(deleteResponse).toBeDefined();
  });
});
