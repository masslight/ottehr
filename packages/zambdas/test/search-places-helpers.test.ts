import { ErxSearchPharmaciesResponse } from '@oystehr/sdk';
import { describe, expect, it } from 'vitest';
import { findMatchingErxPharmacy, reconcilePharmacyPhone } from '../src/patient/search-places/helpers';

describe('reconcilePharmacyPhone', () => {
  it('returns the standardized phone when both sources match', () => {
    expect(reconcilePharmacyPhone('(555) 867-5309', '5558675309')).toBe('(555) 867-5309');
  });

  it('returns the phone when both sources match across differing formats', () => {
    expect(reconcilePharmacyPhone('555-867-5309', '+15558675309')).toBe('(555) 867-5309');
  });

  it('preserves a matching extension', () => {
    expect(reconcilePharmacyPhone('5558675309 x55', '(555) 867-5309 ext. 55')).toBe('(555) 867-5309 x55');
  });

  it('uses the phone with the extension when bases match and only one side has one', () => {
    expect(reconcilePharmacyPhone('5558675309 x55', '(555) 867-5309')).toBe('(555) 867-5309 x55');
    expect(reconcilePharmacyPhone('5558675309', '(555) 867-5309 ext. 55')).toBe('(555) 867-5309 x55');
  });

  it('returns only the base when bases match but extensions conflict', () => {
    expect(reconcilePharmacyPhone('5558675309 x55', '(555) 867-5309 x66')).toBe('(555) 867-5309');
  });

  it('prefers the places phone when both sources are present but differ', () => {
    expect(reconcilePharmacyPhone('(555) 867-5309', '(555) 111-2222')).toBe('(555) 867-5309');
  });

  it('returns undefined when neither can be standardized, even if equal', () => {
    expect(reconcilePharmacyPhone('12345', '12345')).toBeUndefined();
  });

  it('returns the standardizable phone when the other cannot be standardized', () => {
    expect(reconcilePharmacyPhone('not a phone', '5558675309')).toBe('(555) 867-5309');
    expect(reconcilePharmacyPhone('5558675309', 'not a phone')).toBe('(555) 867-5309');
  });

  it('returns the standardized places phone when only places has one', () => {
    expect(reconcilePharmacyPhone('(555) 867-5309', undefined)).toBe('(555) 867-5309');
  });

  it('returns the standardized erx phone when only erx has one', () => {
    expect(reconcilePharmacyPhone(undefined, '5558675309')).toBe('(555) 867-5309');
  });

  it('returns undefined when neither source has a phone', () => {
    expect(reconcilePharmacyPhone(undefined, undefined)).toBeUndefined();
    expect(reconcilePharmacyPhone('', '')).toBeUndefined();
  });
});

describe('findMatchingErxPharmacy', () => {
  const erxPharmacy: ErxSearchPharmaciesResponse['data'][number] = {
    id: 42,
    name: 'Walgreens',
    address1: '123 Pineapple St',
    city: 'Brooklyn',
    state: 'NY',
    zipCode: '11201',
    phone: '5558675309',
    specialties: [],
    // cSpell:disable-next from oystehr sdk
    ncpdpId: '1234567',
  };

  const erxSearchResults: ErxSearchPharmaciesResponse = {
    data: [erxPharmacy],
    metadata: {
      hasPrevious: false,
      hasNext: false,
      total: 1,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
    },
  };

  const placesAddress = {
    streetAddress: undefined,
    streetNumber: '123',
    streetLong: 'Pineapple Street',
    streetShort: 'Pineapple St',
    city: 'Brooklyn',
    stateLong: 'New York',
    stateShort: 'NY',
    zipCode: '11201',
    country: 'United States',
  };

  it('returns the full matched record, including phone', () => {
    const match = findMatchingErxPharmacy('Walgreens', placesAddress, erxSearchResults);
    expect(match).toEqual(erxPharmacy);
    expect(match?.phone).toBe('5558675309');
  });

  it('returns undefined when no result matches', () => {
    const match = findMatchingErxPharmacy('CVS', placesAddress, erxSearchResults);
    expect(match).toBeUndefined();
  });

  it('returns undefined when the places address is missing', () => {
    expect(findMatchingErxPharmacy('Walgreens', undefined, erxSearchResults)).toBeUndefined();
  });
});
