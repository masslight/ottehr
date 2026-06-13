import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for create-charge-master: create a charge master
// (ChargeItemDefinition). The created resource is removed afterwards.
describe('create-charge-master integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let chargeMasterId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-charge-master.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (chargeMasterId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'delete-charge-master', id: chargeMasterId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a charge master', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-charge-master',
      name: `IT Charge Master ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
      description: 'Integration test charge master',
    });
    const output = response.output as { id: string };
    expect(output).toBeDefined();
    expect(typeof output.id).toBe('string');
    chargeMasterId = output.id;
  });
});
