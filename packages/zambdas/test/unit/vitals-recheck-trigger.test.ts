import { MedicationAdministration } from 'fhir/r4b';
import { MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM } from 'utils/lib/types/api/medication-administration.constants';
import {
  medicationApplianceRoutes,
  MedicationData,
  MedicationOrderStatusesType,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, test } from 'vitest';
import { shouldCreateVitalsRecheckNursingOrder } from '../../src/ehr/create-update-medication-order/helpers';

const IV_INFUSION = medicationApplianceRoutes.INFUSION.code; // 424494006
const INTRAVENOUS = medicationApplianceRoutes.INTRAVENOUS.code; // 47625008
const ORAL = medicationApplianceRoutes.ORAL.code;

const makeMedicationAdministration = (routeCode?: string): MedicationAdministration =>
  ({
    resourceType: 'MedicationAdministration',
    id: 'ma-1',
    status: 'in-progress',
    subject: { reference: 'Patient/pat-1' },
    ...(routeCode && {
      dosage: {
        route: { coding: [{ code: routeCode, system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM }] },
      },
    }),
  }) as MedicationAdministration;

const makeOrderData = (route?: string): MedicationData =>
  ({ patient: 'pat-1', encounterId: 'enc-1', dose: 1, route: route ?? '' }) as MedicationData;

const check = ({
  previousStatus = 'pending' as MedicationOrderStatusesType | undefined,
  newStatus,
  route,
  storedRoute,
}: {
  previousStatus?: MedicationOrderStatusesType;
  newStatus: MedicationOrderStatusesType;
  route?: string;
  storedRoute?: string;
}): boolean =>
  shouldCreateVitalsRecheckNursingOrder({
    previousStatus,
    newStatus,
    orderData: makeOrderData(route),
    medicationAdministration: makeMedicationAdministration(storedRoute),
  });

// Administering an in-house medication on an IV route has to prompt a vitals re-check. The trigger keys
// on the route the clinician confirmed plus the status transition, so the cases that matter are: which
// routes count, which statuses count, and not firing twice for one order.
describe('shouldCreateVitalsRecheckNursingOrder', () => {
  test.each([
    ['IV Infusion', IV_INFUSION],
    ['Intravenous', INTRAVENOUS],
  ])('fires when a %s order is administered', (_label, route) => {
    expect(check({ newStatus: 'administered', route })).toBe(true);
  });

  test('fires for partly administered, since IV medication still entered the patient', () => {
    expect(check({ newStatus: 'administered-partly', route: IV_INFUSION })).toBe(true);
  });

  test.each<MedicationOrderStatusesType>(['administered-not', 'cancelled'])(
    'does not fire for status %s',
    (newStatus) => {
      expect(check({ newStatus, route: IV_INFUSION })).toBe(false);
    }
  );

  test('does not fire for a non-IV route', () => {
    expect(check({ newStatus: 'administered', route: ORAL })).toBe(false);
  });

  test('does not fire when the order carries no route at all', () => {
    expect(check({ newStatus: 'administered' })).toBe(false);
  });

  test('falls back to the route stored on the MedicationAdministration when the update omits it', () => {
    expect(check({ newStatus: 'administered', storedRoute: IV_INFUSION })).toBe(true);
    expect(check({ newStatus: 'administered', storedRoute: ORAL })).toBe(false);
  });

  test('prefers the route in the update over the stored one', () => {
    expect(check({ newStatus: 'administered', route: ORAL, storedRoute: IV_INFUSION })).toBe(false);
    expect(check({ newStatus: 'administered', route: IV_INFUSION, storedRoute: ORAL })).toBe(true);
  });

  // Re-saving a completed order through the edit form sends 'administered' again; that must not raise a
  // duplicate re-check order.
  test('does not fire when the order is already in the status being written', () => {
    expect(check({ previousStatus: 'administered', newStatus: 'administered', route: IV_INFUSION })).toBe(false);
    expect(check({ previousStatus: 'administered-partly', newStatus: 'administered-partly', route: IV_INFUSION })).toBe(
      false
    );
  });

  test('fires when an order moves from partly administered to fully administered', () => {
    expect(check({ previousStatus: 'administered-partly', newStatus: 'administered', route: IV_INFUSION })).toBe(true);
  });
});
