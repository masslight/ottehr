import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-em-code: remove an E/M code from the em-codes ValueSet.
// Creates a unique code in setup, then deletes it.
describe('delete-em-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const code = `IT-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-em-code.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    await oystehrZambdas.zambda.execute({ id: 'create-em-code', code, display: 'To Be Deleted' });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('deletes an E/M code', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'delete-em-code', code });
    expect(response.output).toBeDefined();
  });
});
