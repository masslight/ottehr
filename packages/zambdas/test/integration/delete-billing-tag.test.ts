import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-billing-tag: remove a billing tag. A tag is created in
// setup, then deleted.
describe('delete-billing-tag integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let tagId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-billing-tag.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'save-billing-tag',
      name: `IT Tag ${randomUUID().slice(0, 8)}`,
    });
    tagId = (created.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('deletes a billing tag', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'delete-billing-tag', tagId });
    expect(response.output).toBeDefined();
  });
});
