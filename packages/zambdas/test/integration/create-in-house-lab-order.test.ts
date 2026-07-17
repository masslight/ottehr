import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { ActivityDefinition, Provenance } from 'fhir/r4b';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for create-in-house-lab-order (and delete-in-house-lab-order as
// cleanup): create an in-house lab test definition, order it for the seed
// encounter, then delete the order. Covers both order endpoints; FHIR-only.
describe('create-in-house-lab-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let activityDefinitionId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-in-house-lab-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // create-in-house-lab-order requires the encounter to have an attending practitioner.
    const practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    await oystehrAdmin.fhir.patch({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [
        {
          op: 'add',
          path: '/participant',
          value: [
            {
              type: [{ coding: [PRACTITIONER_CODINGS.Attender[0]] }],
              individual: { reference: `Practitioner/${practitionerId}` },
            },
          ],
        },
      ],
    });
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

  it('orders an in-house lab test then deletes the order', async () => {
    // 1. Create the in-house lab test definition to order from.
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
    const ad = await oystehrAdmin.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: activityDefinitionId!,
    });

    // 2. Order it for the seed encounter.
    const diagnosis = { code: 'R05', display: 'Cough', isPrimary: true };
    const orderResponse = await oystehrProvider.zambda.execute({
      id: 'create-in-house-lab-order',
      encounterId: base.encounter.id,
      testItems: [{ adUrl: ad.url, adVersion: ad.version, orderMode: 'standard' }],
      diagnosesAll: [diagnosis],
      diagnosesNew: [diagnosis],
    });
    const serviceRequestIds = (orderResponse.output as { serviceRequestIds?: string[] }).serviceRequestIds;
    expect(serviceRequestIds && serviceRequestIds.length).toBeTruthy();

    // 3. Delete the order (also exercises delete-in-house-lab-order).
    for (const serviceRequestId of serviceRequestIds ?? []) {
      const deleteResponse = await oystehrProvider.zambda.execute({
        id: 'delete-in-house-lab-order',
        serviceRequestId,
      });
      expect(deleteResponse).toBeDefined();
    }
  });
});
