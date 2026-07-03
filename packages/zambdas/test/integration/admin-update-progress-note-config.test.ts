import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface ProgressNoteConfig {
  mdmRequired: boolean;
  medicalDecisionDefaultText: string;
  pcpNoTypeDispositionDefaultText: string;
  anotherDispositionDefaultText: string;
  edDispositionDefaultText: string;
}

// Happy path for admin-update-progress-note-config: it overwrites the project's
// single progress-note config. Read-modify-restore: capture the current config,
// update it with a marker, assert the change via get-progress-note-config, then
// restore the original config in afterAll.
describe('admin-update-progress-note-config integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let original: ProgressNoteConfig;

  // Required text fields must be non-empty; fall back to a placeholder so both
  // the update and the restore always pass validation.
  const complete = (c: ProgressNoteConfig): ProgressNoteConfig => ({
    mdmRequired: c.mdmRequired ?? false,
    medicalDecisionDefaultText: c.medicalDecisionDefaultText || 'N/A',
    pcpNoTypeDispositionDefaultText: c.pcpNoTypeDispositionDefaultText || 'N/A',
    anotherDispositionDefaultText: c.anotherDispositionDefaultText || 'N/A',
    edDispositionDefaultText: c.edDispositionDefaultText || 'N/A',
  });

  const getConfig = async (): Promise<ProgressNoteConfig> =>
    (await oystehrZambdas.zambda.execute({ id: 'get-progress-note-config' })).output as ProgressNoteConfig;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-progress-note-config.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    original = await getConfig();
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-update-progress-note-config', ...complete(original) });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates the progress note config', async () => {
    const marker = `IT-mdm-${randomUUID().slice(0, 8)}`;
    await oystehrZambdas.zambda.execute({
      id: 'admin-update-progress-note-config',
      ...complete(original),
      medicalDecisionDefaultText: marker,
    });
    const after = await getConfig();
    expect(after.medicalDecisionDefaultText).toBe(marker);
  });
});
