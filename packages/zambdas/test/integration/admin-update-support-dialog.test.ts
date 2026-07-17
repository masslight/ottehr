import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Basic } from 'fhir/r4b';
import { M2MClientMockType, SUPPORT_DIALOG_BASIC_TAG } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-update-support-dialog: it overwrites the project's single
// support-dialog Basic resource. To avoid leaving the shared project's config
// changed, we capture the original in beforeAll and restore it in afterAll
// (read-modify-restore).
describe('admin-update-support-dialog integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let original: Basic | undefined;

  const findSupportDialogBasic = async (): Promise<Basic | undefined> => {
    const results = (
      await oystehrAdmin.fhir.search<Basic>({
        resourceType: 'Basic',
        params: [{ name: '_tag', value: `${SUPPORT_DIALOG_BASIC_TAG.system}|${SUPPORT_DIALOG_BASIC_TAG.code}` }],
      })
    ).unbundle();
    return results.find((r): r is Basic => r.resourceType === 'Basic');
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-support-dialog.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    original = await findSupportDialogBasic();
  }, 60_000);

  afterAll(async () => {
    try {
      if (original) {
        // Restore the project's original support-dialog config exactly.
        await oystehrAdmin.fhir.update<Basic>(original);
      } else {
        // No config existed before; remove the one the test created.
        const created = await findSupportDialogBasic();
        if (created?.id) await oystehrAdmin.fhir.delete({ resourceType: 'Basic', id: created.id });
      }
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('updates the support dialog body html', async () => {
    const marker = `IT-support-${randomUUID().slice(0, 8)}`;
    // The update returns 204 No Content (SDK resolves to null); assert the
    // effect by reading the dialog back via get-support-dialog.
    await oystehrZambdas.zambda.execute({
      id: 'admin-update-support-dialog',
      bodyHtml: `<p>${marker}</p>`,
    });
    const after = await oystehrZambdas.zambda.execute({ id: 'get-support-dialog' });
    const output = after.output as { bodyHtml: string };
    expect(output.bodyHtml).toContain(marker);
  });
});
