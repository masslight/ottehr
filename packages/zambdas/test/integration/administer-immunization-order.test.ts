import Oystehr from '@oystehr/sdk';
import { MedicationAdministration, RelatedPerson } from 'fhir/r4b';
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

// Happy path for administer-immunization-order: administer an existing immunization
// order (type 'administered'), which requires the full administrationDetails
// (mvx/ndc/lot/expDate/administeredDateTime/visGivenDate); the CVX code is the
// vaccine's own and is recorded by the endpoint. Sets up an order and removes it
// afterwards. FHIR-only.
describe('administer-immunization-order integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let orderId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('administer-immunization-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const order = await oystehrProvider.zambda.execute({
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
    orderId = (order.output as { orderId: string }).orderId;
  }, 60_000);

  afterAll(async () => {
    if (orderId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'MedicationAdministration', id: orderId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('administers an immunization order', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'administer-immunization-order',
      orderId,
      type: 'administered',
      details: {
        medication: VACCINE,
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: practitionerId, name: 'M2M Client' },
        orderedDateTime: DateTime.now().toUTC().toISO(),
      },
      administrationDetails: {
        mvx: 'PMC',
        ndc: '00006-4047-41',
        lot: 'IT-LOT-1',
        expDate: '2030-01-01',
        administeredDateTime: DateTime.now().toUTC().toISO(),
        visGivenDate: '2026-06-14',
      },
    });
    expect(response.output).toBeDefined();
  });

  it('rejects a partial emergency contact (missing fullName)', async () => {
    let caught: unknown;
    try {
      await oystehrProvider.zambda.execute({
        id: 'administer-immunization-order',
        orderId,
        type: 'administered',
        details: {
          medication: VACCINE,
          dose: '0.5',
          units: 'mL',
          orderedProvider: { id: practitionerId, name: 'M2M Client' },
          orderedDateTime: DateTime.now().toUTC().toISO(),
        },
        administrationDetails: {
          mvx: 'PMC',
          ndc: '00006-4047-41',
          lot: 'IT-LOT-1',
          expDate: '2030-01-01',
          administeredDateTime: DateTime.now().toUTC().toISO(),
          visGivenDate: '2026-06-14',
          // fullName intentionally omitted to reproduce the production payload shape
          emergencyContact: {
            relationship: 'guardian',
            mobile: '+12025550123',
          },
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const message = (caught as { message?: string })?.message ?? JSON.stringify(caught);
    expect(message).toContain('Emergency contact is incomplete');
    expect(message).toContain('fullName');
  });

  it('administers with a complete emergency contact and stores it as a contained RelatedPerson', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'administer-immunization-order',
      orderId,
      type: 'administered',
      details: {
        medication: VACCINE,
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: practitionerId, name: 'M2M Client' },
        orderedDateTime: DateTime.now().toUTC().toISO(),
      },
      administrationDetails: {
        mvx: 'PMC',
        ndc: '00006-4047-41',
        lot: 'IT-LOT-1',
        expDate: '2030-01-01',
        administeredDateTime: DateTime.now().toUTC().toISO(),
        visGivenDate: '2026-06-14',
        emergencyContact: {
          relationship: 'guardian',
          fullName: 'Jane Doe',
          mobile: '+12025550123',
        },
      },
    });
    expect(response.output).toBeDefined();

    const updated = await oystehrAdmin.fhir.get<MedicationAdministration>({
      resourceType: 'MedicationAdministration',
      id: orderId!,
    });
    const relatedPerson = updated.contained?.find((r): r is RelatedPerson => r.resourceType === 'RelatedPerson');
    expect(relatedPerson?.name?.[0]?.text).toBe('Jane Doe');
  });
});
