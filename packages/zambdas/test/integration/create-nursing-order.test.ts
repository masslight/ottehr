import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for create-nursing-order: create a nursing-order ServiceRequest
// for an encounter. The created ServiceRequest(s) are deleted afterwards.
describe('create-nursing-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-nursing-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // create-nursing-order requires the encounter to have an attending practitioner.
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
    try {
      const srs = (
        await oystehrAdmin.fhir.search<ServiceRequest>({
          resourceType: 'ServiceRequest',
          params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
        })
      ).unbundle();
      await Promise.all(srs.map((sr) => oystehrAdmin.fhir.delete({ resourceType: 'ServiceRequest', id: sr.id! })));
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('creates a nursing order for an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'create-nursing-order',
      encounterId: base.encounter.id,
      notes: 'Integration test nursing order',
    });
    expect(response.output).toBeDefined();
  });
});
