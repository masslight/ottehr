import { MedicationAdministration } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { vaccineSiteLocations } from '../types/api/medication-administration.types';
import { getLocationFromMedicationAdministration, searchMedicationLocation } from './medication-administration';

const withSite = (code: string, display: string): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  status: 'completed',
  subject: { reference: 'Patient/p' },
  effectiveDateTime: '2026-11-11',
  dosage: { site: { coding: [{ system: 'http://snomed.info/sct', code, display }] } },
});

describe('vaccine sites', () => {
  it('each side has its own code', () => {
    const codes = vaccineSiteLocations.map((site) => site.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('a vaccine site saves and reads back by its name', () => {
    const thigh = searchMedicationLocation('61396006', 'Left thigh (vastus lateralis)');
    expect(thigh?.name).toBe('Left thigh (vastus lateralis)');
    expect(searchMedicationLocation('16217701000119102', 'Left deltoid')?.name).toBe('Left deltoid');

    expect(getLocationFromMedicationAdministration(withSite('61396006', 'Left thigh (vastus lateralis)'))).toEqual({
      code: '61396006',
      name: 'Left thigh (vastus lateralis)',
    });
    expect(getLocationFromMedicationAdministration(withSite('16217701000119102', 'Left deltoid'))?.name).toBe(
      'Left deltoid'
    );
    // a medication site still reads as before
    expect(
      getLocationFromMedicationAdministration(
        withSite('16217701000119102', 'Structure of left deltoid muscle (body structure)')
      )?.name
    ).toBe('Left Deltoid');
  });
});
