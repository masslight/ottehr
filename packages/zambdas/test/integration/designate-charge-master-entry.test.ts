import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for designate-charge-master-entry: tag a charge master with a
// designation (self-pay). A fresh charge master is created in setup and removed.
describe('designate-charge-master-entry integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let chargeMasterId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('designate-charge-master-entry.test.ts', M2MClientMockType.provider);
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

  it('designates a charge master entry as self-pay', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'designate-charge-master-entry',
      chargeMasterId,
      designation: 'self-pay',
    });
    expect(response.output).toBeDefined();
  });
});
