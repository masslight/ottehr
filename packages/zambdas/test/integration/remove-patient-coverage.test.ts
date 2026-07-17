import Oystehr from '@oystehr/sdk';
import { Account, Coverage } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for remove-patient-coverage: removes a coverage from a patient's
// account (cancels the Coverage). Seeds a Coverage for the patient first. FHIR-only.
describe('remove-patient-coverage integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let coverageId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('remove-patient-coverage.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const coverage = await oystehrAdmin.fhir.create<Coverage>({
      resourceType: 'Coverage',
      status: 'active',
      order: 1,
      beneficiary: { reference: `Patient/${base.patient.id}` },
      payor: [{ display: 'Integration Test Payer' }],
    });
    coverageId = coverage.id;

    // The account-ref path picks up coverages referenced by the patient's billing
    // Account (priority 1), so link the coverage onto the seed Account.
    const accounts = (
      await oystehrAdmin.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();
    const account = accounts[0];
    await oystehrAdmin.fhir.patch<Account>({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        {
          op: 'add',
          path: '/coverage',
          value: [{ coverage: { reference: `Coverage/${coverage.id}` }, priority: 1 }],
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    if (coverageId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Coverage', id: coverageId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('removes a coverage from the patient account', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'remove-patient-coverage',
      patientId: base.patient.id,
      coverageId,
    });
    expect(response.output).toBeDefined();
  });
});
