import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for disassociate-payer: remove a payer association from a fee
// schedule. The association is created in setup; resources removed afterwards.
describe('disassociate-payer integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;
  let organizationId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('disassociate-payer.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    feeScheduleId = (created.output as { id: string }).id;
    const org = await oystehrAdmin.fhir.create<Organization>({
      resourceType: 'Organization',
      name: `IT Payer ${randomUUID().slice(0, 8)}`,
    });
    organizationId = org.id!;
    await oystehrZambdas.zambda.execute({ id: 'associate-payer', feeScheduleId, organizationId });
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => oystehrZambdas.zambda.execute({ id: 'delete-fee-schedule', id: feeScheduleId }),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Organization', id: organizationId }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('disassociates a payer organization from a fee schedule', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'disassociate-payer', feeScheduleId, organizationId });
    expect(response.output).toBeDefined();
  });
});
