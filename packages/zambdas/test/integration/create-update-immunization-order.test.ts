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

// Happy path for create-update-immunization-order: create an immunization order
// (MedicationAdministration) for an encounter, referencing a real Medication and
// the ordering practitioner. The order + Medication are removed afterwards.
describe('create-update-immunization-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let medicationId: string;
  let orderId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-update-immunization-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const med = await oystehrZambdas.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Vaccine ${randomUUID().slice(0, 8)}`,
      medispanID: `IT-${randomUUID().slice(0, 8)}`,
    });
    medicationId = (med.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (orderId ? oystehrAdmin.fhir.delete({ resourceType: 'MedicationAdministration', id: orderId }) : undefined),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('creates an immunization order for an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
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
    const output = response.output as { orderId: string };
    expect(output).toBeDefined();
    expect(typeof output.orderId).toBe('string');
    orderId = output.orderId;
  });
});
