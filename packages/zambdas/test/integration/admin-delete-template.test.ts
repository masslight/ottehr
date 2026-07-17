import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-delete-template: create a template, then delete it.
describe('admin-delete-template integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-delete-template.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-template',
      encounterId: base.encounter.id,
      templateName: `IT Delete ${randomUUID().slice(0, 8)}`,
    });
    templateId = (created.output as { templateId: string }).templateId;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('deletes a template', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-delete-template', templateId });
    const output = response.output as { message: string };
    expect(output).toBeDefined();
    expect(typeof output.message).toBe('string');
  });
});
