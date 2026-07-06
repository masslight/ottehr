import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for create-manual-task: create a manual follow-up Task at a
// (throwaway) location. The created Task + Location are removed afterwards.
describe('create-manual-task integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let locationId: string;
  let locationName: string;
  let taskId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-manual-task.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    locationName = `Manual Task Loc ${randomUUID().slice(0, 8)}`;
    const location = await oystehrAdmin.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: locationName },
        setup.processId
      ) as Location
    );
    locationId = location.id!;
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (taskId ? oystehrAdmin.fhir.delete({ resourceType: 'Task', id: taskId }) : undefined),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Location', id: locationId }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates a manual follow-up task', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-manual-task',
      category: 'manual-patient-follow-up',
      taskTitle: 'Integration test manual task',
      location: { id: locationId, name: locationName },
    });
    const output = response.output as { id?: string };
    expect(output).toBeDefined();
    taskId = output.id;
  });
});
