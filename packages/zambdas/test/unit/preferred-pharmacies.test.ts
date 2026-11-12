import { Patient } from 'fhir/r4b';
import { PREFERRED_PHARMACY_PLACES_ID_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { makePreferredPharmacies } from '../../src/shared/chart-data/preferred-pharmacies';

const patient = (extension?: { url: string; valueString: string }[]): Patient => ({
  resourceType: 'Patient',
  contained: [
    {
      resourceType: 'Organization',
      id: 'pharmacy',
      name: 'CVS Pharmacy',
      address: [{ text: '1200 S Congress Ave, Austin, TX 78704, USA' }],
      telecom: [{ system: 'phone', value: '(512) 555-0142' }],
      ...(extension ? { extension } : {}),
    },
  ],
});

describe('makePreferredPharmacies', () => {
  it('includes the Google place ID of a pharmacy picked with the Google search', () => {
    expect(
      makePreferredPharmacies(patient([{ url: PREFERRED_PHARMACY_PLACES_ID_URL, valueString: 'place-1' }]), undefined)
    ).toEqual([
      {
        name: 'CVS Pharmacy',
        address: '1200 S Congress Ave, Austin, TX 78704, USA',
        phone: '(512) 555-0142',
        placesId: 'place-1',
      },
    ]);
  });

  it('has no place ID for a pharmacy entered by hand', () => {
    expect(makePreferredPharmacies(patient(), undefined)[0]).not.toHaveProperty('placesId');
  });
});
