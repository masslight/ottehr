import {
  medicationApplianceLocations,
  medicationApplianceRoutes,
  MedicationData,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it, vi } from 'vitest';
import { validateAllMedicationFields } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/utils';

const LOCATION = { code: medicationApplianceLocations[0].code, name: medicationApplianceLocations[0].name! };

// A pending order with everything the administer form requires except the location.
const makeOrder = (route: string, location?: MedicationData['location']): MedicationData => ({
  patient: 'pat-1',
  encounterId: 'enc-1',
  medicationId: 'med-1',
  dose: 1,
  units: 'mg',
  route,
  providerId: 'prov-1',
  lotNumber: 'LOT-1',
  expDate: '2030-01-01',
  effectiveDateTime: '2026-01-01T10:00:00.000Z',
  location,
});

const missingFieldsFor = (
  localValues: Partial<MedicationData>,
  medication: MedicationData,
  type: Parameters<typeof validateAllMedicationFields>[2]
): string[] => validateAllMedicationFields(localValues, medication, type, vi.fn()).missingFields;

describe('validateAllMedicationFields - location for injectables', () => {
  const INTRAMUSCULAR = medicationApplianceRoutes.INTRAMUSCULAR.code;
  const ORAL = medicationApplianceRoutes.ORAL.code;

  it('requires location when an injectable order is administered', () => {
    const order = makeOrder(INTRAMUSCULAR);
    expect(missingFieldsFor({ ...order }, order, 'dispense')).toEqual(['location']);
  });

  it('accepts an administered injectable order that has a location', () => {
    const order = makeOrder(INTRAMUSCULAR, LOCATION);
    expect(missingFieldsFor({ ...order }, order, 'dispense')).toEqual([]);
  });

  it('does not require location for a non-injectable route', () => {
    const order = makeOrder(ORAL);
    expect(missingFieldsFor({ ...order }, order, 'dispense')).toEqual([]);
  });

  it('does not require location when the order is not administered', () => {
    const order = makeOrder(INTRAMUSCULAR);
    expect(missingFieldsFor({ ...order }, order, 'dispense-not-administered')).toEqual([]);
  });

  it('uses the route picked on the form rather than the saved one', () => {
    const order = makeOrder(ORAL);
    expect(missingFieldsFor({ ...order, route: INTRAMUSCULAR }, order, 'dispense')).toEqual(['location']);
  });

  it('treats a location cleared on the form as missing even though the saved order has one', () => {
    const order = makeOrder(INTRAMUSCULAR, LOCATION);
    expect(missingFieldsFor({ ...order, location: undefined }, order, 'dispense')).toEqual(['location']);
  });

  it('falls back to the saved order for fields the form has not touched', () => {
    const order = makeOrder(INTRAMUSCULAR, LOCATION);
    expect(missingFieldsFor({}, order, 'dispense')).toEqual([]);
  });
});
