import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-rename-template: create a template, then rename it.
describe('admin-rename-template integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-rename-template.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName: `IT Rename ${randomUUID().slice(0, 8)}`,
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

  it('renames a template', async () => {
    const newName = `IT Renamed ${randomUUID().slice(0, 8)}`;
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-rename-template', templateId, newName });
    const output = response.output as { templateId: string; newName: string };
    expect(output).toBeDefined();
    expect(output.newName).toBe(newName);
    expect(output.templateId).toBe(templateId);
  });
});
