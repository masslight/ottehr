import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-add-lab-set: create an in-house lab set (a FHIR List).
// The created List is removed afterwards.
describe('admin-add-lab-set integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let labSetId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-add-lab-set.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (labSetId) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'List', id: labSetId });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates an in-house lab set', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-add-lab-set',
      labSetFormInput: {
        listId: '',
        listName: `IT Lab Set ${randomUUID().slice(0, 8)}`,
        listStatus: 'Active',
        listType: 'in-house',
        labs: [{ display: 'IT In-House Lab', adUrl: 'https://example.com/activity-definition' }],
      },
    });
    const output = response.output as { labSetId: string };
    expect(output).toBeDefined();
    expect(typeof output.labSetId).toBe('string');
    labSetId = output.labSetId;
  });
});
