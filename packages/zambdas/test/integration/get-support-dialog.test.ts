import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-support-dialog: returns the project's support-dialog
// configuration payload. Provider-scoped, no body required.
describe('get-support-dialog integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-support-dialog.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a support dialog config object', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'get-support-dialog' });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
