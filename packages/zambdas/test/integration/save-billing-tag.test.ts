import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for save-billing-tag: create a billing tag. The created tag is
// removed afterwards via delete-billing-tag.
describe('save-billing-tag integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let tagId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-billing-tag.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (tagId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'delete-billing-tag', tagId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a billing tag', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'save-billing-tag',
      name: `IT Tag ${randomUUID().slice(0, 8)}`,
      description: 'Integration test billing tag',
    });
    const output = response.output as { id: string };
    expect(output).toBeDefined();
    expect(typeof output.id).toBe('string');
    tagId = output.id;
  });
});
