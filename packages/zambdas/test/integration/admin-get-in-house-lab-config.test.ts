import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-get-in-house-lab-config: returns the config for an in-house
// lab test definition. Creates a throwaway lab to read, deletes it in teardown.
describe('admin-get-in-house-lab-config integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let activityDefinitionId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-get-in-house-lab-config.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const addResponse = await oystehrProvider.zambda.execute({
      id: 'admin-add-in-house-lab',
      userId: randomUUID(),
      data: {
        name: `ITLab${randomUUID().replace(/-/g, '').slice(0, 10)}`,
        cptCode: [{ code: '99000' }],
        repeatTest: false,
        components: [{ componentName: 'Result', dataType: 'string', display: { type: 'Free Text' } }],
      },
    });
    activityDefinitionId = (addResponse.output as { activityDefinitionId: string }).activityDefinitionId;
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

  it('returns the in-house lab config', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'admin-get-in-house-lab-config',
      activityDefinitionId,
    });
    expect(response.output).toBeDefined();
  });
});
