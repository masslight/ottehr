import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-employees: returns the list of employee (practitioner)
// detail records for the project. Provider-scoped.
describe('get-employees integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-employees.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns an employees array', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'get-employees' });
    const output = response.output as { message: string; employees: unknown[] };
    expect(output).toBeDefined();
    expect(typeof output.message).toBe('string');
    expect(Array.isArray(output.employees)).toBe(true);
  });
});
