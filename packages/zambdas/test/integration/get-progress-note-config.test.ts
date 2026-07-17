import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-progress-note-config: returns the project's progress note
// configuration payload. Provider-scoped, no body required.
describe('get-progress-note-config integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-progress-note-config.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a progress note config object', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'get-progress-note-config' });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
