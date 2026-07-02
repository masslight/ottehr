import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for associate-payer: associate a payer Organization with a fee
// schedule. A fresh fee schedule + Organization are created in setup and
// removed afterwards.
describe('cm-associate-payer integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let chargeMasterId: string;
  let organizationId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('associate-payer.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-charge-master',
      name: `IT Charge Master ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    chargeMasterId = (created.output as { id: string }).id;
    const org = await oystehrAdmin.fhir.create<Organization>({
      resourceType: 'Organization',
      name: `IT Payer ${randomUUID().slice(0, 8)}`,
    });
    organizationId = org.id!;
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => oystehrAdmin.fhir.delete({ resourceType: 'ChargeItemDefinition', id: chargeMasterId }),
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

  it('associates a payer organization with a charge master', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'cm-associate-payer', chargeMasterId, organizationId });
    expect(response.output).toBeDefined();
  });
});
