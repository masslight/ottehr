import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-get-template-detail: create a template, then fetch its
// detail by id. Cleans up the template afterwards.
describe('admin-get-template-detail integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-get-template-detail.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName: `IT Detail ${randomUUID().slice(0, 8)}`,
    });
    templateId = (created.output as { templateId: string }).templateId;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrZambdas.zambda.execute({ id: 'admin-delete-template', templateId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('returns detail for a template', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-get-template-detail', templateId });
    expect(response.output).toBeDefined();
  });
});
