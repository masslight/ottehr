import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for create-em-code: add a new E/M code to the project's em-codes
// ValueSet. Uses a unique code and removes it afterwards.
describe('create-em-code integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const code = `IT-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-em-code.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-em-code', code });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('creates an E/M code', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-em-code',
      code,
      display: 'Integration Test E/M Code',
    });
    expect(response.output).toBeDefined();
  });
});
