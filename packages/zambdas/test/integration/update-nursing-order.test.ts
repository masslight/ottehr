import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for update-nursing-order: complete an existing nursing-order
// ServiceRequest. A nursing order is created in setup; created ServiceRequest(s)
// are deleted afterwards.
describe('update-nursing-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-nursing-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
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
    await oystehrZambdas.zambda.execute({
      id: 'create-nursing-order',
      encounterId: base.encounter.id,
      notes: 'Integration test nursing order',
    });
    const srs = (
      await oystehrAdmin.fhir.search<ServiceRequest>({
        resourceType: 'ServiceRequest',
        params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
      })
    ).unbundle();
    serviceRequestId = srs[0].id!;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'ServiceRequest', id: serviceRequestId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('completes a nursing order', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-nursing-order',
      serviceRequestId,
      action: 'COMPLETE ORDER',
    });
    expect(response.output).toBeDefined();
  });
});
