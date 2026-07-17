import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-get-quick-picks: returns the configured quick picks for
// a given category. Uses the stable 'allergy-quick-pick' category code.
describe('admin-get-quick-picks integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-get-quick-picks.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns quick picks for a category', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-get-quick-picks',
      category: 'allergy-quick-pick',
    });
    const output = response.output as { message: string; quickPicks: unknown[] };
    expect(output).toBeDefined();
    expect(typeof output.message).toBe('string');
    expect(Array.isArray(output.quickPicks)).toBe(true);
  });
});
