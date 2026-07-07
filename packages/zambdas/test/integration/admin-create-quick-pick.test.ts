import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-create-quick-pick: create an allergy quick pick. The
// created quick pick is removed afterwards.
describe('admin-create-quick-pick integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let quickPickId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-create-quick-pick.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (quickPickId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'admin-remove-quick-pick', quickPickId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates an allergy quick pick', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-quick-pick',
      category: 'allergy-quick-pick',
      quickPick: { name: `IT Allergy ${randomUUID().slice(0, 8)}` },
    });
    const output = response.output as { message: string; quickPick: { id: string } };
    expect(output).toBeDefined();
    expect(typeof output.quickPick.id).toBe('string');
    quickPickId = output.quickPick.id;
  });
});
