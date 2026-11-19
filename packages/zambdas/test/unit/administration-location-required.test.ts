import { Medication, MedicationAdministration, Patient } from 'fhir/r4b';
import { MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM } from 'utils/lib/types/api/medication-administration.constants';
import {
  medicationApplianceLocations,
  medicationApplianceRoutes,
  MedicationData,
  MedicationOrderStatusesType,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, test } from 'vitest';
import {
  updateMedicationAdministrationData,
  validateAdministrationLocation,
} from '../../src/ehr/create-update-medication-order/helpers';

const INTRAMUSCULAR = medicationApplianceRoutes.INTRAMUSCULAR.code;
const ORAL = medicationApplianceRoutes.ORAL.code;
const LOCATION = medicationApplianceLocations[0];

const makeMedicationAdministration = ({
  route,
  withLocation = false,
}: {
  route?: string;
  withLocation?: boolean;
}): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'in-progress',
  subject: { reference: 'Patient/pat-1' },
  dosage: {
    ...(route && { route: { coding: [{ code: route, system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM }] } }),
    ...(withLocation && {
      site: { coding: [{ code: LOCATION.code, system: LOCATION.system, display: LOCATION.display }] },
    }),
  },
});

const expectRejected = (newStatus: MedicationOrderStatusesType, ma: MedicationAdministration): void => {
  expect(() => validateAdministrationLocation(newStatus, ma)).toThrow(
    expect.objectContaining({ message: expect.stringContaining('Location is required') })
  );
};

describe('validateAdministrationLocation', () => {
  test.each<MedicationOrderStatusesType>(['administered', 'administered-partly'])(
    'rejects an injectable order saved as %s without a location',
    (newStatus) => {
      expectRejected(newStatus, makeMedicationAdministration({ route: INTRAMUSCULAR }));
    }
  );

  test('accepts an injectable order saved as administered with a location', () => {
    expect(() =>
      validateAdministrationLocation(
        'administered',
        makeMedicationAdministration({ route: INTRAMUSCULAR, withLocation: true })
      )
    ).not.toThrow();
  });

  test('accepts a non-injectable order saved as administered without a location', () => {
    expect(() =>
      validateAdministrationLocation('administered', makeMedicationAdministration({ route: ORAL }))
    ).not.toThrow();
  });

  // Existing orders without a location stay as they are unless they are saved as administered again.
  test.each<MedicationOrderStatusesType | undefined>([undefined, 'administered-not', 'cancelled'])(
    'accepts an injectable order without a location when the update sets status %s',
    (newStatus) => {
      expect(() =>
        validateAdministrationLocation(newStatus, makeMedicationAdministration({ route: INTRAMUSCULAR }))
      ).not.toThrow();
    }
  );
});

// The zambda validates the MedicationAdministration that updateMedicationAdministrationData builds, so what counts
// is the route and site that end up on it.
describe('validateAdministrationLocation on the updated MedicationAdministration', () => {
  const buildUpdatedMA = (
    existedMA: MedicationAdministration,
    orderData: Partial<MedicationData>,
    newStatus: MedicationOrderStatusesType
  ): MedicationAdministration =>
    updateMedicationAdministrationData({
      orderData: { patient: 'pat-1', encounterId: 'enc-1', ...orderData } as MedicationData,
      orderResources: { medicationAdministration: existedMA, patient: { resourceType: 'Patient' } as Patient },
      medicationResource: { resourceType: 'Medication' } as Medication,
      newStatus,
    });

  test('passes when the update carries a location', () => {
    const updated = buildUpdatedMA(
      makeMedicationAdministration({ route: INTRAMUSCULAR }),
      { dose: 1, units: 'mg', route: INTRAMUSCULAR, location: { code: LOCATION.code, name: LOCATION.name! } },
      'administered'
    );
    expect(() => validateAdministrationLocation('administered', updated)).not.toThrow();
  });

  test('fails when the update clears the saved location of an injectable order', () => {
    const updated = buildUpdatedMA(
      makeMedicationAdministration({ route: INTRAMUSCULAR, withLocation: true }),
      { dose: 1, units: 'mg', route: INTRAMUSCULAR },
      'administered'
    );
    expectRejected('administered', updated);
  });

  test('fails when the update switches the route to an injectable one without a location', () => {
    const updated = buildUpdatedMA(
      makeMedicationAdministration({ route: ORAL }),
      { dose: 1, units: 'mg', route: INTRAMUSCULAR },
      'administered'
    );
    expectRejected('administered', updated);
  });
});
