import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for save-patient-instruction: create a provider instruction
// (Communication). Returns a DTO with the new resource id, which is removed
// afterwards via delete-patient-instruction.
describe('save-patient-instruction integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let instructionId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-patient-instruction.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (instructionId) {
      try {
        await oystehrZambdas.zambda.execute({ id: 'delete-patient-instruction', instructionId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('saves a provider instruction', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'save-patient-instruction',
      text: `Integration test instruction ${randomUUID().slice(0, 8)}`,
    });
    const output = response.output as { resourceId: string };
    expect(output).toBeDefined();
    expect(typeof output.resourceId).toBe('string');
    instructionId = output.resourceId;
  });
});
