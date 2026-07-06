import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for update-in-house-medication: rename an existing in-house
// Medication. Created in setup; removed afterwards.
describe('update-in-house-medication integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let medicationId: string;
  const medispanID = `IT-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-in-house-medication.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Medication ${randomUUID().slice(0, 8)}`,
      medispanID,
    });
    medicationId = (created.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates an in-house medication', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-in-house-medication',
      medicationID: medicationId,
      name: `IT Medication Updated ${randomUUID().slice(0, 8)}`,
      status: 'active',
      medispanID,
    });
    expect(response.output).toBeDefined();
  });
});
