import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// A vaccine from the vaccine list (CVX_VACCINES): its id is its CVX code.
const VACCINE = { id: '115', name: 'Tdap' };

// Happy path for create-update-immunization-order: create an immunization order
// (MedicationAdministration) for an encounter, for a vaccine from the vaccine list and
// the ordering practitioner. The order is removed afterwards.
describe('create-update-immunization-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let orderId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-update-immunization-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (orderId ? oystehrAdmin.fhir.delete({ resourceType: 'MedicationAdministration', id: orderId }) : undefined),
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
        medication: VACCINE,
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
