import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-add-in-house-lab: creates an in-house lab test definition
// (an ActivityDefinition tagged "latest" + a Provenance). FHIR-only. The created
// resources are deleted in teardown.
describe('admin-add-in-house-lab integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let activityDefinitionId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-add-in-house-lab.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (activityDefinitionId) {
      const provenances = await oystehrAdmin.fhir
        .search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `ActivityDefinition/${activityDefinitionId}` }],
        })
        .then((r) => r.unbundle())
        .catch(() => []);
      for (const p of provenances) {
        await oystehrAdmin.fhir.delete({ resourceType: 'Provenance', id: p.id! }).catch(() => undefined);
      }
      await oystehrAdmin.fhir
        .delete({ resourceType: 'ActivityDefinition', id: activityDefinitionId })
        .catch(() => undefined);
    }
    await cleanup();
  });

  it('creates an in-house lab test definition', async () => {
    const name = `ITLab${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const response = await oystehrProvider.zambda.execute({
      id: 'admin-add-in-house-lab',
      userId: randomUUID(),
      data: {
        name,
        cptCode: [{ code: '99000' }],
        repeatTest: false,
        components: [
          {
            componentName: 'Result',
            dataType: 'string',
            display: { type: 'Free Text' },
          },
        ],
      },
    });
    const output = response.output as { activityDefinitionId?: string };
    expect(output.activityDefinitionId).toBeDefined();
    activityDefinitionId = output.activityDefinitionId;
  });
});
