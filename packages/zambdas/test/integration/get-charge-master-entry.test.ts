import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-charge-master-entry: look up the applicable self-pay charge
// master entry for a date of service. Returns a well-formed payload (the match
// may be null when no self-pay charge master is designated).
describe('get-charge-master-entry integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-charge-master-entry.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the applicable self-pay charge master entry', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-charge-master-entry',
      designation: 'self-pay',
      dateOfService: '2026-06-13',
    });
    expect(response.output).toBeDefined();
  });
});
