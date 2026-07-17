import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-update-quick-pick: rename an existing allergy quick pick.
// Created in setup; removed afterwards.
describe('admin-update-quick-pick integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let quickPickId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-quick-pick.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-quick-pick',
      category: 'allergy-quick-pick',
      quickPick: { name: `IT Allergy ${randomUUID().slice(0, 8)}` },
    });
    quickPickId = (created.output as { quickPick: { id: string } }).quickPick.id;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-remove-quick-pick', quickPickId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates an allergy quick pick', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-update-quick-pick',
      category: 'allergy-quick-pick',
      quickPickId,
      quickPick: { name: `IT Updated ${randomUUID().slice(0, 8)}` },
    });
    expect(response.output).toBeDefined();
  });
});
