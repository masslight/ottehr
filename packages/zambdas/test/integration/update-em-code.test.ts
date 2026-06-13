import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for update-em-code: change the display of an existing E/M code.
// Creates a unique code in setup and removes it afterwards.
describe('update-em-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const code = `IT-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-em-code.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    await oystehrZambdas.zambda.execute({ id: 'create-em-code', code, display: 'Original Display' });
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-em-code', code });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates an E/M code display', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-em-code',
      code,
      display: 'Updated Display',
    });
    expect(response.output).toBeDefined();
  });
});
