import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for export-invoices (both modes): kick off a CSV export (creates an
// export Task, returns its id), then check that task's status. FHIR + Oystehr z3
// only; the created Task is deleted afterward.
describe('export-invoices integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let taskId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('export-invoices.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (taskId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Task', id: taskId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('kicks off an invoice CSV export and reports its status', async () => {
    const kickoff = await oystehrProvider.zambda.execute({
      id: 'export-invoices',
      status: 'ready',
    });
    taskId = (kickoff.output as { taskId: string }).taskId;
    expect(taskId).toBeDefined();

    const status = await oystehrProvider.zambda.execute({
      id: 'export-invoices',
      taskId,
    });
    expect(status.output).toBeDefined();
    expect((status.output as { status?: string }).status).toBeDefined();
  });
});
