import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface LabelPrintingConfig {
  mode: 'manual' | 'integrated';
  [k: string]: unknown;
}

// Happy path for admin-update-label-printing-config: it writes the project's
// single label-printing config (stored on a Device). To avoid changing shared
// state we read the current config and write the same value back (idempotent
// re-save), then assert it round-trips via get-label-printing-config.
describe('admin-update-label-printing-config integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let originalConfig: LabelPrintingConfig;

  const getConfig = async (): Promise<LabelPrintingConfig> =>
    (
      (await oystehrZambdas.zambda.execute({ id: 'get-label-printing-config' })).output as {
        config: LabelPrintingConfig;
      }
    ).config;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-label-printing-config.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    originalConfig = await getConfig();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('writes the label printing config (idempotent re-save)', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'admin-update-label-printing-config',
      config: originalConfig,
    });
    const after = await getConfig();
    expect(after.mode).toBe(originalConfig.mode);
  });
});
