import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for upload-patient-condition-photo: records a patient condition
// photo (a DocumentReference pointing at an already-uploaded z3 file) for an
// appointment. Created DocumentReferences are removed afterwards.
describe('upload-patient-condition-photo integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('upload-patient-condition-photo.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    try {
      const docs = (
        await oystehrAdmin.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [{ name: 'subject', value: `Patient/${base.patient.id}` }],
        })
      ).unbundle();
      await Promise.all(docs.map((d) => oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: d.id! })));
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('records a patient condition photo for an appointment', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'upload-patient-condition-photo',
      appointmentID: base.appointment.id,
      z3URL: 'https://example.com/integration-test-condition-photo.jpg',
      title: 'Integration test condition photo',
    });
    expect(response.output).toBeDefined();
  });
});
