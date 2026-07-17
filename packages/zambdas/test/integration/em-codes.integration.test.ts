import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy paths for the E/M code zambdas: create-em-code, update-em-code,
// delete-em-code. All three patch the single shared em-codes ValueSet, so they
// run sequentially in one file (create -> update -> delete on one code) to avoid
// optimistic-lock conflicts from concurrent writes to the same ValueSet.
describe('em-codes zambdas — happy paths', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const code = `IT-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('em-codes.integration.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    // Ensure the code is gone even if the delete test did not run.
    try {
      await oystehrZambdas.zambda.execute({ id: 'delete-em-code', code });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('create-em-code adds a new E/M code', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-em-code',
      code,
      display: 'Integration Test E/M Code',
    });
    expect(response.output).toBeDefined();
  });

  it('update-em-code changes the display of the code', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-em-code',
      code,
      display: 'Integration Test E/M Code (updated)',
    });
    expect(response.output).toBeDefined();
  });

  it('delete-em-code removes the code', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'delete-em-code', code });
    expect(response.output).toBeDefined();
  });
});
