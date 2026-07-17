import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for create-in-house-medication: create an in-house Medication.
// The created Medication is removed afterwards.
describe('create-in-house-medication integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let medicationId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-in-house-medication.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (medicationId) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates an in-house medication', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Medication ${randomUUID().slice(0, 8)}`,
      medispanID: `IT-${randomUUID().slice(0, 8)}`,
    });
    const output = response.output as { id: string };
    expect(output).toBeDefined();
    expect(typeof output.id).toBe('string');
    medicationId = output.id;
  });
});
