import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { MedicationRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for create-update-medication-order: create a medication order
// (MedicationRequest) for the seed encounter, referencing a real Medication and
// the ordering provider. The order + Medication are removed afterwards. FHIR-only.
describe('create-update-medication-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let medicationId: string;
  let orderId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-update-medication-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const med = await oystehrProvider.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Med ${randomUUID().slice(0, 8)}`,
      medispanID: `IT-${randomUUID().slice(0, 8)}`,
    });
    medicationId = (med.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    if (orderId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'MedicationRequest', id: orderId }).catch(() => undefined);
    }
    await oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId }).catch(() => undefined);
    await cleanup();
  });

  it('creates a medication order for an encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'create-update-medication-order',
      orderData: {
        patient: base.patient.id,
        encounter: base.encounter.id,
        encounterId: base.encounter.id,
        medicationId,
        dose: 1,
        units: 'mg',
        route: '26643006', // SNOMED 'Oral route'
        providerId: practitionerId,
      },
    });
    expect(response.output).toBeDefined();

    // Find the created order to clean it up.
    const orders = (
      await oystehrAdmin.fhir.search<MedicationRequest>({
        resourceType: 'MedicationRequest',
        params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
      })
    ).unbundle();
    orderId = orders[0]?.id;
  });
});
