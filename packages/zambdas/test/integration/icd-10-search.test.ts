import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for icd-10-search: searches the bundled ICD-10 dataset (a local file,
// no third-party call) and returns matching codes.
describe('icd-10-search integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('icd-10-search.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns ICD-10 codes matching a search term', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'icd-10-search',
      search: 'cough',
    });
    expect(response.output).toBeDefined();
  });
});
