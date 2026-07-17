import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-unsolicited-results-resources: the 'unsolicited-results-icon'
// request type is a no-setup read that reports whether unsolicited lab results
// are pending (FHIR-backed; no third-party calls).
describe('get-unsolicited-results-resources integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-unsolicited-results-resources.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the unsolicited-results icon status', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-unsolicited-results-resources',
      requestType: 'unsolicited-results-icon',
    });
    expect(response.output).toBeDefined();
  });
});
