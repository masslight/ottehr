import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BILLING_RESOURCE_TAG } from '../../src/billing/shared';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for create-billing-working-copy: clone a billing-workspace resource
// into an editable working copy. The seed patient is tagged into the billing
// workspace first; the created working copy is removed afterwards.
describe('create-billing-working-copy integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let workingCopyId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-billing-working-copy.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const patient = await oystehrAdmin.fhir.get<Patient>({ resourceType: 'Patient', id: base.patient.id! });
    await oystehrAdmin.fhir.update<Patient>({
      ...patient,
      meta: { ...patient.meta, tag: [...(patient.meta?.tag ?? []), BILLING_RESOURCE_TAG] },
    });
  }, 60_000);

  afterAll(async () => {
    if (workingCopyId) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Patient', id: workingCopyId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a working copy of a billing resource', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-billing-working-copy',
      resourceType: 'Patient',
      resourceId: base.patient.id,
    });
    const output = response.output as { id: string; resourceType: string };
    expect(output).toBeDefined();
    expect(typeof output.id).toBe('string');
    workingCopyId = output.id;
  });
});
