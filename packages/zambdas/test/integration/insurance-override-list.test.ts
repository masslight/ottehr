import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy paths for the EHR insurance-override-list zambdas:
//   add-payer-to-insurance-override-list, edit-payer-in-insurance-override-list,
//   remove-payer-from-insurance-override-list.
// These all mutate a single shared override List resource, so they are exercised
// sequentially in one file (add → edit → remove) to avoid optimistic-lock
// conflicts that arise from concurrent writes to the same List.
describe('insurance-override-list zambdas — happy paths', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const payerId = `it-payer-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('insurance-override-list.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({
        id: 'remove-payer-from-insurance-override-list',
        listName: 'ehr',
        payerId,
      });
    } catch {
      // best-effort — the remove test may already have removed it
    }
    await cleanup();
  });

  it('add-payer-to-insurance-override-list adds a payer to the EHR override list', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'add-payer-to-insurance-override-list',
      listName: 'ehr',
      payerId,
      payerNote: 'Integration test override',
    });
    expect(response.output).toBeDefined();
  });

  it('edit-payer-in-insurance-override-list edits the payer entry', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'edit-payer-in-insurance-override-list',
      listName: 'ehr',
      payerId,
      payerNote: 'Updated note',
    });
    expect(response.output).toBeDefined();
  });

  it('remove-payer-from-insurance-override-list removes the payer entry', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'remove-payer-from-insurance-override-list',
      listName: 'ehr',
      payerId,
    });
    expect(response.output).toBeDefined();
  });
});
