import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for delete-patient-instruction: remove a provider instruction.
// A Communication is created in setup, then deleted.
describe('delete-patient-instruction integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let instructionId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-patient-instruction.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'save-patient-instruction',
      text: `Integration test instruction ${randomUUID().slice(0, 8)}`,
    });
    instructionId = (created.output as { resourceId: string }).resourceId;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('deletes a provider instruction', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'delete-patient-instruction', instructionId });
    expect(response.output).toBeDefined();
  });
});
