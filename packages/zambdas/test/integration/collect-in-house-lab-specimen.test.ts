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

// Happy path for collect-in-house-lab-specimen: mark the specimen collected for an
// in-house lab order. Sets up a lab definition + order, then collects; tears the
// order + definition down afterward. FHIR-only.
describe('collect-in-house-lab-specimen integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let activityDefinitionId: string | undefined;
  let serviceRequestIds: string[] = [];
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('collect-in-house-lab-specimen.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
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
    const diagnosis = { code: 'R05', display: 'Cough', isPrimary: true };
    const orderResponse = await oystehrProvider.zambda.execute({
      id: 'create-in-house-lab-order',
      encounterId: base.encounter.id,
      testItems: [{ adUrl: ad.url, adVersion: ad.version, orderMode: 'standard' }],
      diagnosesAll: [diagnosis],
      diagnosesNew: [diagnosis],
    });
    serviceRequestIds = (orderResponse.output as { serviceRequestIds: string[] }).serviceRequestIds;
  }, 60_000);

  afterAll(async () => {
    for (const serviceRequestId of serviceRequestIds) {
      await oystehrProvider.zambda
        .execute({ id: 'delete-in-house-lab-order', serviceRequestId })
        .catch(() => undefined);
    }
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

  it('collects the specimen for an in-house lab order', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'collect-in-house-lab-specimen',
      encounterId: base.encounter.id,
      serviceRequestId: serviceRequestIds[0],
      data: {
        specimen: {
          collectedBy: { id: practitionerId, name: 'Integration Test Provider' },
          collectionDate: new Date().toISOString(),
        },
      },
    });
    expect(response).toBeDefined();
  });
});
