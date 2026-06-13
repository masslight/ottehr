import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-procedure-code: delete a procedure code from a fee
// schedule. A fresh fee schedule with one code is created in setup and removed
// afterwards.
describe('delete-procedure-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-procedure-code.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    feeScheduleId = (created.output as { id: string }).id;
    await oystehrZambdas.zambda.execute({
      id: 'add-procedure-code',
      feeScheduleId,
      code: '99213',
      description: 'Office visit',
      amount: 10000,
    });
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-fee-schedule', id: feeScheduleId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('deletes a procedure code from a fee schedule', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'delete-procedure-code',
      feeScheduleId,
      index: 0,
    });
    expect(response.output).toBeDefined();
  });
});
