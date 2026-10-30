import { describe, expect, it } from 'vitest';
import { ErxDirectoryPharmacy } from '../types/api/erx-search.types';
import {
  directoryPharmacyToResult,
  directoryQueryForPlace,
  matchDirectoryPharmacy,
  normalizeStreet,
  parseAddressText,
  pharmacyNamesMatch,
  PharmacyPlace,
} from './erx-pharmacy-match';

const place = (overrides: Partial<PharmacyPlace> = {}): PharmacyPlace => ({
  name: 'CVS Pharmacy',
  streetNumber: '1200',
  streetLong: 'North Main Street',
  streetShort: 'N Main St',
  city: 'Austin',
  stateShort: 'TX',
  zipCode: '78704',
  ...overrides,
});

const row = (overrides: Partial<ErxDirectoryPharmacy> = {}): ErxDirectoryPharmacy => ({
  ncpdpId: '4412345',
  npi: '1234567893',
  name: 'CVS/PHARMACY #1234',
  address1: '1200 N MAIN ST',
  city: 'AUSTIN',
  state: 'TX',
  zipCode: '787041234',
  phone: '5125550142',
  specialties: ['Retail'],
  ...overrides,
});

describe('pharmacyNamesMatch', () => {
  it.each([
    ['CVS Pharmacy', 'CVS/PHARMACY #1234'],
    ['H-E-B Pharmacy', 'HEB PHARMACY #123'],
    ['Walgreens', 'WALGREENS DRUG STORE #09552'],
    ['Walgreens Pharmacy', 'WALGREENS DRUG STORE #09552'],
  ])('%s matches %s', (google, directory) => {
    expect(pharmacyNamesMatch(google, directory)).toBe(true);
  });

  it('does not match a different brand', () => {
    expect(pharmacyNamesMatch('Walgreens', 'CVS/PHARMACY #1234')).toBe(false);
  });
});

describe('normalizeStreet', () => {
  it.each([
    ['1200 N Main St', '1200 N MAIN ST STE 100'],
    ['1200 N Main St', '1200 N. MAIN ST'],
    ['1200 North Main Street', '1200 N MAIN ST'],
    ['1200 N Main St', '1200 N MAIN ST SUITE 100'],
    ['1200 N Main St', '1200 N MAIN ST #100'],
    ['1200 N Main St', '1200 N MAIN ST, UNIT 4'],
    ['500 W Highway 290', '500 WEST HWY 290'],
  ])('%s equals %s', (google, directory) => {
    expect(normalizeStreet(google)).toBe(normalizeStreet(directory));
  });
});

describe('matchDirectoryPharmacy', () => {
  it.each([
    ['CVS Pharmacy', 'CVS/PHARMACY #1234'],
    ['H-E-B Pharmacy', 'HEB PHARMACY #123'],
  ])('matches Google %s to directory %s at the same address', (google, directory) => {
    const match = row({ name: directory });
    expect(matchDirectoryPharmacy(place({ name: google }), [match])).toBe(match);
  });

  it.each(['1200 N MAIN ST STE 100', '1200 N. MAIN ST', '1200 N MAIN ST'])(
    'matches Google 1200 N Main St to directory %s',
    (address1) => {
      const match = row({ address1 });
      expect(matchDirectoryPharmacy(place({ streetLong: 'N Main St' }), [match])).toBe(match);
    }
  );

  it('matches Google 1200 North Main Street to directory 1200 N MAIN ST', () => {
    const match = row();
    expect(matchDirectoryPharmacy(place({ streetShort: undefined }), [match])).toBe(match);
  });

  it('picks the matching row out of others', () => {
    const match = row();
    const others = [row({ address1: '1300 N MAIN ST', ncpdpId: '1' }), row({ name: 'WALGREENS #1', ncpdpId: '2' })];
    expect(matchDirectoryPharmacy(place(), [...others, match])).toBe(match);
  });

  it('does not match a different street number', () => {
    expect(matchDirectoryPharmacy(place(), [row({ address1: '1202 N MAIN ST' })])).toBeUndefined();
  });

  it('does not match a different zip', () => {
    expect(matchDirectoryPharmacy(place(), [row({ zipCode: '78705' })])).toBeUndefined();
  });

  it('does not match a different street', () => {
    expect(matchDirectoryPharmacy(place(), [row({ address1: '1200 S MAIN ST' })])).toBeUndefined();
  });

  it('does not match a different name', () => {
    expect(matchDirectoryPharmacy(place(), [row({ name: 'WALGREENS #09552' })])).toBeUndefined();
  });

  it('is no match when two rows match (ambiguous)', () => {
    expect(matchDirectoryPharmacy(place(), [row(), row({ ncpdpId: '4499999' })])).toBeUndefined();
  });

  it('is no match without a street number or zip', () => {
    expect(matchDirectoryPharmacy(place({ streetNumber: undefined }), [row()])).toBeUndefined();
    expect(matchDirectoryPharmacy(place({ zipCode: undefined }), [row()])).toBeUndefined();
  });
});

describe('directoryQueryForPlace', () => {
  it('searches by street number and the street’s first letter, with city and state', () => {
    expect(directoryQueryForPlace(place())).toEqual({ address: '1200 n', city: 'Austin', state: 'TX' });
  });

  it('uses the long street name without a short one', () => {
    expect(directoryQueryForPlace(place({ streetShort: undefined, streetLong: 'Congress Avenue' }))).toEqual({
      address: '1200 c',
      city: 'Austin',
      state: 'TX',
    });
  });

  it('is undefined without a street number', () => {
    expect(directoryQueryForPlace(place({ streetNumber: undefined }))).toBeUndefined();
  });
});

describe('parseAddressText', () => {
  it('parses a Google formatted address', () => {
    expect(parseAddressText('CVS Pharmacy', '1200 S Congress Ave, Austin, TX 78704, USA')).toEqual({
      name: 'CVS Pharmacy',
      streetNumber: '1200',
      streetLong: 'S Congress Ave',
      streetShort: 'S Congress Ave',
      city: 'Austin',
      stateShort: 'TX',
      zipCode: '78704',
    });
  });

  it('parses a suite part and a 9-digit zip', () => {
    expect(parseAddressText('CVS', '1200 N Main St, Ste 100, Austin, tx 78704-1234')).toMatchObject({
      streetLong: 'N Main St',
      city: 'Austin',
      stateShort: 'TX',
      zipCode: '78704',
    });
  });

  it.each(['CVS on Main', 'Main St, Austin, TX 78704', '1200 N Main St, Austin, Texas'])(
    'is undefined for "%s"',
    (text) => {
      expect(parseAddressText('CVS', text)).toBeUndefined();
    }
  );
});

describe('directoryPharmacyToResult', () => {
  it('takes the NCPDP ID, NPI, name and phone from the row and formats its address', () => {
    expect(directoryPharmacyToResult(row({ address2: 'STE 100' }))).toEqual({
      ncpdpId: '4412345',
      npi: '1234567893',
      name: 'CVS/PHARMACY #1234',
      phone: '5125550142',
      address: '1200 N MAIN ST STE 100, AUSTIN, TX 78704',
    });
  });

  it('is undefined for a row without an NPI, which an order needs', () => {
    expect(directoryPharmacyToResult(row({ npi: undefined }))).toBeUndefined();
  });
});
