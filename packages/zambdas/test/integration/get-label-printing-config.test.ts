import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-label-printing-config: with no deviceId, returns the project's
// label-printing configuration. Read-only (FHIR Basic/Device), no third party.
describe('get-label-printing-config integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-label-printing-config.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the label printing config', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-label-printing-config',
    });
    expect(response.output).toBeDefined();
  });
});
