import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { version as packageVersion } from '../../package.json';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for the `version` zambda: it echoes back the zambdas package
// version and ignores all input. Just assert it is reachable and returns the
// expected shape.
describe('version integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('version.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the package version', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'version' });
    const output = response.output as { version: string };
    expect(output).toBeDefined();
    expect(typeof output.version).toBe('string');
    expect(output.version).toBe(packageVersion);
  });
});
