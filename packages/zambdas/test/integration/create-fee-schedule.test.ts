import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for create-fee-schedule: create a fee schedule
// (ChargeItemDefinition). The created resource is removed afterwards.
describe('create-fee-schedule integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-fee-schedule.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (feeScheduleId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'delete-fee-schedule', id: feeScheduleId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a fee schedule', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
      description: 'Integration test fee schedule',
    });
    const output = response.output as { id: string };
    expect(output).toBeDefined();
    expect(typeof output.id).toBe('string');
    feeScheduleId = output.id;
  });
});
