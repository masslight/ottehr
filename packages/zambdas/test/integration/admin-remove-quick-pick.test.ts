import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-remove-quick-pick: remove an existing allergy quick pick.
// Created in setup, then removed.
describe('admin-remove-quick-pick integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let quickPickId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-remove-quick-pick.test.ts', M2MClientMockType.provider);
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
    await cleanup();
  });

  it('removes an allergy quick pick', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-remove-quick-pick', quickPickId });
    expect(response.output).toBeDefined();
  });
});
