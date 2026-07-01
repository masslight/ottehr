import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-create-template: build a (global) note template from an
// encounter's chart. Returns { templateName, templateId }. The created template
// is removed via admin-delete-template afterwards.
describe('admin-create-template integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let createdTemplateId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-create-template.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (createdTemplateId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'admin-delete-template', templateId: createdTemplateId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a template from an encounter', async () => {
    const templateName = `IT Template ${randomUUID().slice(0, 8)}`;
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName,
    });
    const output = response.output as { templateName: string; templateId: string };
    expect(output).toBeDefined();
    expect(output.templateName).toBe(templateName);
    expect(typeof output.templateId).toBe('string');
    createdTemplateId = output.templateId;
  });
});
