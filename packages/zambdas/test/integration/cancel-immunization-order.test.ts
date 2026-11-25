import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for cancel-immunization-order: cancel an existing immunization
// order. The order is created in setup and removed afterwards.
describe('cancel-immunization-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let orderId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('cancel-immunization-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'create-update-immunization-order',
      encounterId: base.encounter.id,
      details: {
        medication: { id: '115', name: 'Tdap' },
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: practitionerId, name: 'M2M Client' },
        orderedDateTime: DateTime.now().toUTC().toISO(),
      },
    });
    orderId = (created.output as { orderId: string }).orderId;
  }, 60_000);

  afterAll(async () => {
    if (orderId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'MedicationAdministration', id: orderId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('cancels an immunization order', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'cancel-immunization-order', orderId });
    expect(response.output).toBeDefined();
  });
});
