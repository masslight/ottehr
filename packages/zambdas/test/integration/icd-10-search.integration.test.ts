import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface Icd10SearchResponse {
  codes: Array<{ code: string; display: string }>;
}

// Happy path for icd-10-search: a non-empty search string returns a list of
// matching ICD-10 codes. "diabetes" is a stable, broadly-supported query.
describe('icd-10-search integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('icd-10-search.integration.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns matching ICD-10 codes for a search term', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'icd-10-search', search: 'diabetes' });
    const output = response.output as Icd10SearchResponse;
    expect(output).toBeDefined();
    expect(Array.isArray(output.codes)).toBe(true);
    expect(output.codes.length).toBeGreaterThan(0);
    for (const entry of output.codes) {
      expect(typeof entry.code).toBe('string');
      expect(typeof entry.display).toBe('string');
    }
  });
});
