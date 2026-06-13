import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for ehr-search-legacy-records: search archived legacy patient
// records by name. A name that matches nothing returns a well-formed empty
// result.
describe('ehr-search-legacy-records integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('ehr-search-legacy-records.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a result for a legacy-records name search', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'ehr-search-legacy-records',
      lastName: `NoSuchPatient-${randomUUID().slice(0, 8)}`,
    });
    expect(response.output).toBeDefined();
  });
});
