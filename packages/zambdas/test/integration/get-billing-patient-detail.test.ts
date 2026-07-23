import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-billing-patient-detail: returns the billing detail for a
// patient. The billing zambdas operate in a tag-scoped "billing workspace"
// (BILLING_RESOURCE_TAG), so the seed patient is tagged into that workspace
// before querying. FHIR-backed (no third-party calls).
describe('get-billing-patient-detail integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-billing-patient-detail.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // Make the patient visible to the billing workspace.
    const patient = await setup.oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: base.patient.id! });
    await setup.oystehr.fhir.update<Patient>({
      ...patient,
      meta: { ...patient.meta, tag: [...(patient.meta?.tag ?? []), BILLING_RESOURCE_TAG] },
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns billing detail for a patient', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-billing-patient-detail',
      patientId: base.patient.id,
    });
    expect(response.output).toBeDefined();
  });
});
