import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for list-templates: returns the project's note templates.
// includeVersionData is a required boolean flag.
describe('list-templates integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('list-templates.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns templates when includeVersionData is false', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'list-templates',
      includeVersionData: false,
    });
    expect(response.output).toBeDefined();
  });
});
