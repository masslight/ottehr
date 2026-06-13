import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for cm-add-procedure-code: add a procedure code to a charge master.
// A fresh charge master is created in setup and removed afterwards.
describe('cm-add-procedure-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let chargeMasterId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('cm-add-procedure-code.test.ts', M2MClientMockType.provider);
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

  it('adds a procedure code to a charge master', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'cm-add-procedure-code',
      chargeMasterId,
      code: '99213',
      description: 'Office visit',
      amount: 10000,
    });
    expect(response.output).toBeDefined();
  });
});
