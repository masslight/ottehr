import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-fee-schedule: delete a fee schedule. The zambda reads
// the resource id from a body param literally named `id`, which collides with
// the SDK's zambda-selector `id` in zambda.execute(); so we invoke it with a
// direct POST to the local server. A fresh fee schedule is created in setup.
describe('delete-fee-schedule integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let token: string;
  let executeUrl: string;
  let cleanup: () => Promise<void>;
  let feeScheduleId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-fee-schedule.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    token = setup.testUserM2MToken;
    executeUrl = inject('EXECUTE_ZAMBDA_URL');
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-fee-schedule',
      name: `IT Fee Schedule ${randomUUID().slice(0, 8)}`,
      effectiveDate: '2026-01-01',
    });
    feeScheduleId = (created.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    // Best-effort in case the delete did not run; ignore "already deleted".
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'ChargeItemDefinition', id: feeScheduleId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('deletes a fee schedule', async () => {
    const response = await fetch(`${executeUrl}/zambda/delete-fee-schedule/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: feeScheduleId }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { status: number; output: unknown };
    expect(json.output).toBeDefined();
  });
});
