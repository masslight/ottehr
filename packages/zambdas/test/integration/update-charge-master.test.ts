import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for update-charge-master: rename an existing charge master. A fresh
// charge master is created in setup and removed afterwards.
describe('update-charge-master integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let chargeMasterId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-charge-master.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-charge-master',
      name: `IT Charge Master ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    chargeMasterId = (created.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-charge-master', id: chargeMasterId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates a charge master', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-charge-master',
      chargeMasterId,
      name: `IT Charge Master Updated ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-02-01',
    });
    expect(response.output).toBeDefined();
  });
});
