import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for apply-template: create a note template from an encounter, then
// apply it to that encounter. The template is removed afterwards.
describe('apply-template integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let templateName: string;
  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('apply-template.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    templateName = `IT Apply ${randomUUID().slice(0, 8)}`;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName,
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

  it('applies a template to an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'apply-template',
      templateName,
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });
});
