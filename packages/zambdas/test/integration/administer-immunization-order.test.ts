import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for administer-immunization-order: administer an existing immunization
// order (type 'administered'), which requires the full administrationDetails
// (mvx/cvx/ndc/lot/expDate/administeredDateTime/visGivenDate). Sets up a Medication
// + order, removes them afterwards. FHIR-only.
describe('administer-immunization-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let medicationId: string;
  let orderId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('administer-immunization-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const med = await oystehrProvider.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Vaccine ${randomUUID().slice(0, 8)}`,
      medispanID: `IT-${randomUUID().slice(0, 8)}`,
    });
    medicationId = (med.output as { id: string }).id;

    const order = await oystehrProvider.zambda.execute({
      id: 'create-update-immunization-order',
      encounterId: base.encounter.id,
      details: {
        medication: { id: medicationId, name: 'IT Vaccine' },
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: practitionerId, name: 'M2M Client' },
        orderedDateTime: DateTime.now().toUTC().toISO(),
      },
    });
    orderId = (order.output as { orderId: string }).orderId;
  }, 60_000);

  afterAll(async () => {
    if (orderId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'MedicationAdministration', id: orderId }).catch(() => undefined);
    }
    await oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId }).catch(() => undefined);
    await cleanup();
  });

  it('administers an immunization order', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'administer-immunization-order',
      orderId,
      type: 'administered',
      details: {
        medication: { id: medicationId, name: 'IT Vaccine' },
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: practitionerId, name: 'M2M Client' },
        orderedDateTime: DateTime.now().toUTC().toISO(),
      },
      administrationDetails: {
        mvx: 'PMC',
        cvx: '141',
        ndc: '00006-4047-41',
        lot: 'IT-LOT-1',
        expDate: '2030-01-01',
        administeredDateTime: DateTime.now().toUTC().toISO(),
        visGivenDate: '2026-06-14',
      },
    });
    expect(response.output).toBeDefined();
  });
});
