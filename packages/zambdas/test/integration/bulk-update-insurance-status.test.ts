import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for bulk-update-insurance-status: toggle the `active` flag on a set
// of insurance (Organization) resources. Uses a throwaway insurance
// Organization, which is removed afterwards.
describe('bulk-update-insurance-status integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let insuranceId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('bulk-update-insurance-status.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const org = await oystehrAdmin.fhir.create<Organization>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Organization', active: true, name: `IT Insurance ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Organization
    );
    insuranceId = org.id!;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'Organization', id: insuranceId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('sets insurance status to inactive', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'bulk-update-insurance-status',
      insuranceIds: [insuranceId],
      active: false,
    });
    const output = response.output as { updatedCount: number };
    expect(output).toBeDefined();
    expect(output.updatedCount).toBe(1);
    const refreshed = await oystehrAdmin.fhir.get<Organization>({ resourceType: 'Organization', id: insuranceId });
    expect(refreshed.active).toBe(false);
  });
});
