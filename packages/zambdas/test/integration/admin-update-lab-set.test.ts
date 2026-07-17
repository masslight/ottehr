import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-update-lab-set: toggle the status of an existing lab set.
// A lab set is created in setup and removed afterwards.
describe('admin-update-lab-set integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let labSetId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-lab-set.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-add-lab-set',
      labSetFormInput: {
        listId: '',
        listName: `IT Lab Set ${randomUUID().slice(0, 8)}`,
        listStatus: 'Active',
        listType: 'in-house',
        labs: [{ display: 'IT In-House Lab', adUrl: 'https://example.com/activity-definition' }],
      },
    });
    labSetId = (created.output as { labSetId: string }).labSetId;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'List', id: labSetId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('toggles the status of a lab set', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-update-lab-set',
      updateType: 'toggle-status',
      data: { labSetId },
    });
    expect(response.output).toBeDefined();
  });
});
