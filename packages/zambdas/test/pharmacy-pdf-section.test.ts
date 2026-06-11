import { Organization } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { composePharmacyData } from '../src/shared/pdf/sections/pharmacyInfo';

const pharmacy: Organization = {
  resourceType: 'Organization',
  id: 'pharmacy',
  name: 'Walgreens',
  address: [
    {
      text: '123 Pineapple St, Brooklyn, NY 11201',
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '(555) 867-5309',
    },
  ],
};

describe('composePharmacyData', () => {
  it('composes name, address and phone from the pharmacy Organization', () => {
    expect(composePharmacyData(pharmacy)).toEqual({
      name: 'Walgreens',
      address: '123 Pineapple St, Brooklyn, NY 11201',
      phone: '(555) 867-5309',
    });
  });

  it('composes an empty phone when the pharmacy has no phone telecom', () => {
    const noPhone: Organization = {
      ...pharmacy,
      telecom: [
        {
          system: 'fax',
          value: '(555) 999-8888',
        },
      ],
    };
    expect(composePharmacyData(noPhone).phone).toBe('');
  });

  it('composes empty fields when there is no pharmacy', () => {
    expect(composePharmacyData(undefined)).toEqual({
      name: '',
      address: '',
      phone: '',
    });
  });
});
