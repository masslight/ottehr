import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for add-procedure-code: add a procedure code to a fee schedule.
// A fresh fee schedule is created in setup and removed afterwards.
describe('add-procedure-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('add-procedure-code.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    feeScheduleId = (created.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-fee-schedule', id: feeScheduleId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('adds a procedure code to a fee schedule', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'add-procedure-code',
      feeScheduleId,
      code: '99213',
      description: 'Office visit',
      amount: 10000,
    });
    expect(response.output).toBeDefined();
  });
});
