import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-label-printing-config: returns the label printing config
// for the project (deviceId is optional). The endpoint always returns 200.
describe('get-label-printing-config integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'get-label-printing-config.integration.test.ts',
      M2MClientMockType.provider
    );
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a label printing config payload', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'get-label-printing-config' });
    expect(response.output).toBeDefined();
  });
});
