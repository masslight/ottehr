import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface OutreachConfig {
  actions: unknown[];
  notificationsTimeRestriction?: unknown;
}

// Happy path for save-scheduled-outreach-config: it writes the project's single
// scheduled-outreach PlanDefinition. To avoid changing shared state we read the
// current config and save the same actions back (idempotent — re-saving
// identical actions reconciles to no task changes), then assert it round-trips.
describe('save-scheduled-outreach-config integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let original: OutreachConfig;

  const getConfig = async (): Promise<OutreachConfig> =>
    (await oystehrZambdas.zambda.execute({ id: 'get-scheduled-outreach-config' })).output as OutreachConfig;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-scheduled-outreach-config.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    original = await getConfig();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('saves the scheduled outreach config (idempotent re-save)', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'save-scheduled-outreach-config',
      actions: original.actions ?? [],
      notificationsTimeRestriction: original.notificationsTimeRestriction,
    });
    const after = await getConfig();
    expect(Array.isArray(after.actions)).toBe(true);
    expect(after.actions.length).toBe((original.actions ?? []).length);
  });
});
