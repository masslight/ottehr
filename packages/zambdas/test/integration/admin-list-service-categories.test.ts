import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-list-service-categories: returns the list of
// admin-registered service categories. No body required.
describe('admin-list-service-categories integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-list-service-categories.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a service categories payload', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-list-service-categories' });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
