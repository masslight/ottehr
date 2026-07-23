import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for update-procedure-code: update a procedure code on a fee
// schedule. A fresh fee schedule with one code is created in setup and removed
// afterwards.
describe('update-procedure-code integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-procedure-code.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
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
      await oystehrAdmin.fhir.delete({ resourceType: 'ChargeItemDefinition', id: feeScheduleId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates a procedure code on a fee schedule', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-procedure-code',
      feeScheduleId,
      index: 0,
      code: '99213',
      description: 'Office visit (updated)',
      amount: 12500,
    });
    expect(response.output).toBeDefined();
  });
});
