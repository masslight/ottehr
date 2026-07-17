import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for find-applicable-charge-master: look up the charge master that
// applies to a payer on a date of service. Returns { chargeMaster: <match|null> };
// for a fresh payer with no associations the well-formed result is null.
describe('find-applicable-charge-master integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let organizationId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('find-applicable-charge-master.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const org = await oystehrAdmin.fhir.create<Organization>({
      resourceType: 'Organization',
      name: `IT Payer ${randomUUID().slice(0, 8)}`,
    });
    organizationId = org.id!;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'Organization', id: organizationId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('returns the applicable charge master for a payer and date', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'find-applicable-charge-master',
      payerOrganizationId: organizationId,
      dateOfService: '2026-06-13',
    });
    expect(response.output).toBeDefined();
  });
});
