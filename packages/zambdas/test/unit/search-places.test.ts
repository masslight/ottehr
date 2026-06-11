import { describe, expect, it } from 'vitest';
import {
  addressComponentsFromPlacesDetailRes,
  extractPharmacyIdFromSearchRes,
  getAddressParamsForErxPharmacySearch,
} from '../../src/patient/search-places/helpers';

const EXPECTED_ERX_ID = '12345';
const PLACES_NAME = 'Walgreens';

const PLACES_ADDRESS_COMPONENTS = [
  { longText: '2745', shortText: '2745', types: ['street_number'], languageCode: 'en-US' },
  { longText: 'Long Beach Road', shortText: 'Long Beach Rd', types: ['route'], languageCode: 'en' },
  { longText: 'Oceanside', shortText: 'Oceanside', types: ['locality', 'political'], languageCode: 'en' },
  {
    longText: 'Hempstead',
    shortText: 'Hempstead',
    types: ['administrative_area_level_3', 'political'],
    languageCode: 'en',
  },
  {
    longText: 'Nassau County',
    shortText: 'Nassau County',
    types: ['administrative_area_level_2', 'political'],
    languageCode: 'en',
  },
  { longText: 'New York', shortText: 'NY', types: ['administrative_area_level_1', 'political'], languageCode: 'en' },
  { longText: 'United States', shortText: 'US', types: ['country', 'political'], languageCode: 'en' },
  { longText: '11572', shortText: '11572', types: ['postal_code'], languageCode: 'en-US' },
];

const PARSED_ADDRESS = {
  streetAddress: undefined,
  streetNumber: '2745',
  streetLong: 'Long Beach Road',
  streetShort: 'Long Beach Rd',
  city: 'Oceanside',
  stateShort: 'NY',
  stateLong: 'New York',
  zipCode: '11572',
  country: 'United States',
};

const ERX_RESULTS = [
  {
    id: EXPECTED_ERX_ID,
    name: 'WALGREENS DRUG STORE #10728',
    address1: '2745 LONG BEACH RD',
    address2: null,
    city: 'OCEANSIDE',
    state: 'NY',
    zipCode: '11572-2225',
    phone: '5165947024',
    fax: '5165947028',
    specialties: ['Retail', 'EPCS'],
    ncpdpId: '0000000',
  },
  {
    id: 67890,
    name: 'Test Drug Store #123',
    address1: '2438 Winbrook Cook Rd',
    address2: '2435 Colony Lane Rd',
    city: 'DETROIT',
    state: 'OK',
    zipCode: '967204104',
    phone: '8474768051',
    fax: '8442225555',
    specialties: ['24 Hour Pharmacy'],
    ncpdpId: '6666666',
  },
  {
    id: 44444,
    name: 'Test Pharmacy',
    address1: '1111, lane 0ne',
    address2: null,
    city: 'salt lake city',
    state: 'UT',
    zipCode: '84119',
    phone: '4343434343',
    fax: '5423423434',
    specialties: ['Mail Order', 'EPCS'],
    ncpdpId: '7777777',
  },
  {
    id: 11111,
    name: 'Fake Pharmacy',
    address1: '11 first lane',
    address2: null,
    city: 'salt lake city',
    state: 'UT',
    zipCode: '84119',
    phone: '4323434234',
    fax: '2343323223',
    specialties: ['Mail Order', 'EPCS'],
    ncpdpId: '8888888',
  },
] as any;

// ── addressComponentsFromPlacesDetailRes ───────────────────────────────────────

describe('addressComponentsFromPlacesDetailRes', () => {
  it('parses a full address component array into the correct structure', () => {
    expect(addressComponentsFromPlacesDetailRes(PLACES_ADDRESS_COMPONENTS)).toEqual(PARSED_ADDRESS);
  });

  it('returns undefined when input is not an array', () => {
    expect(addressComponentsFromPlacesDetailRes(null)).toBeUndefined();
    expect(addressComponentsFromPlacesDetailRes(undefined)).toBeUndefined();
    expect(addressComponentsFromPlacesDetailRes('string')).toBeUndefined();
    expect(addressComponentsFromPlacesDetailRes({})).toBeUndefined();
  });

  it('returns an object with all fields undefined for an empty array', () => {
    const result = addressComponentsFromPlacesDetailRes([]);
    expect(result).toEqual({
      streetAddress: undefined,
      streetNumber: undefined,
      streetLong: undefined,
      streetShort: undefined,
      city: undefined,
      stateShort: undefined,
      stateLong: undefined,
      zipCode: undefined,
      country: undefined,
    });
  });

  it('skips components that have no types array', () => {
    const components = [
      { longText: 'Oceanside' }, // types is not included, we need this to know what we are reading
      { longText: 'New York', shortText: 'NY', types: ['administrative_area_level_1', 'political'] },
    ];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.city).toBeUndefined();
    expect(result?.stateLong).toBe('New York');
    expect(result?.stateShort).toBe('NY');
  });

  it('skips components that have no longText', () => {
    const components = [
      { shortText: 'Ocs', types: ['locality'] }, // no longText
      { longText: '11572', types: ['postal_code'] },
    ];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.city).toBeUndefined();
    expect(result?.zipCode).toBe('11572');
  });

  it('sets stateShort from shortText and stateLong from longText', () => {
    const components = [{ longText: 'New York', shortText: 'NY', types: ['administrative_area_level_1', 'political'] }];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.stateLong).toBe('New York');
    expect(result?.stateShort).toBe('NY');
  });

  it('sets streetShort from shortText and streetLong from longText for routes', () => {
    const components = [{ longText: 'Long Beach Road', shortText: 'Long Beach Rd', types: ['route'] }];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.streetLong).toBe('Long Beach Road');
    expect(result?.streetShort).toBe('Long Beach Rd');
  });

  it('omits streetShort when shortText is absent on a route component', () => {
    const components = [{ longText: 'Long Beach Road', types: ['route'] }];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.streetLong).toBe('Long Beach Road');
    expect(result?.streetShort).toBeUndefined();
  });

  it('parses a partial address containing only city and zip', () => {
    const components = [
      { longText: 'Oceanside', types: ['locality', 'political'] },
      { longText: '11572', types: ['postal_code'] },
    ];
    const result = addressComponentsFromPlacesDetailRes(components);
    expect(result?.city).toBe('Oceanside');
    expect(result?.zipCode).toBe('11572');
    expect(result?.streetNumber).toBeUndefined();
    expect(result?.stateLong).toBeUndefined();
  });
});

// ── getAddressParamsForErxPharmacySearch ──────────────────────────────────────

describe('getAddressParamsForErxPharmacySearch', () => {
  it('returns an empty array when input is undefined', () => {
    expect(getAddressParamsForErxPharmacySearch(undefined)).toEqual([]);
  });

  it('returns two params for a full address — long and short form', () => {
    const params = getAddressParamsForErxPharmacySearch(PARSED_ADDRESS);
    expect(params).toHaveLength(2);

    const [longParam, shortParam] = params;
    expect(longParam.address).toBe('2745 Long Beach Road');
    expect(shortParam.address).toBe('2745 Long Beach Rd');
  });

  it('includes city and state in both params', () => {
    const [longParam, shortParam] = getAddressParamsForErxPharmacySearch(PARSED_ADDRESS);
    expect(longParam.city).toBe('Oceanside');
    expect(longParam.state).toBe('NY');
    expect(shortParam.city).toBe('Oceanside');
    expect(shortParam.state).toBe('NY');
  });

  it('omits address from both params when streetNumber is missing', () => {
    const addressWithoutStreetNumber = { ...PARSED_ADDRESS, streetNumber: undefined };
    const [longParam, shortParam] = getAddressParamsForErxPharmacySearch(addressWithoutStreetNumber);
    expect(longParam.address).toBeUndefined();
    expect(shortParam.address).toBeUndefined();
  });

  it('omits address from both params when street names are missing', () => {
    const addressWithoutStreet = { ...PARSED_ADDRESS, streetLong: undefined, streetShort: undefined };
    const [longParam, shortParam] = getAddressParamsForErxPharmacySearch(addressWithoutStreet);
    expect(longParam.address).toBeUndefined();
    expect(shortParam.address).toBeUndefined();
  });

  it('returns params with only city and state when street fields are absent', () => {
    const cityStateOnly = {
      streetAddress: undefined,
      streetNumber: undefined,
      streetLong: undefined,
      streetShort: undefined,
      city: 'Oceanside',
      stateShort: 'NY',
      stateLong: 'New York',
      zipCode: undefined,
      country: undefined,
    };
    const [longParam, shortParam] = getAddressParamsForErxPharmacySearch(cityStateOnly);
    expect(longParam).toEqual({ city: 'Oceanside', state: 'NY' });
    expect(shortParam).toEqual({ city: 'Oceanside', state: 'NY' });
  });

  it('omits city and state from params when they are undefined', () => {
    const noStateOrCity = { ...PARSED_ADDRESS, city: undefined, stateShort: undefined };
    const [longParam, shortParam] = getAddressParamsForErxPharmacySearch(noStateOrCity);
    expect(longParam.city).toBeUndefined();
    expect(longParam.state).toBeUndefined();
    expect(shortParam.city).toBeUndefined();
    expect(shortParam.state).toBeUndefined();
  });
});

// ── extractPharmacyIdFromSearchRes ────────────────────────────────────────────

describe('extractPharmacyIdFromSearchRes', () => {
  it('returns the pharmacy id when name and address match', () => {
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, PARSED_ADDRESS, ERX_RESULTS);
    expect(result).toBe(EXPECTED_ERX_ID);
  });

  it('matches case-insensitively on pharmacy name', () => {
    expect(extractPharmacyIdFromSearchRes(PLACES_NAME.toUpperCase(), PARSED_ADDRESS, ERX_RESULTS)).toBe(
      EXPECTED_ERX_ID
    );
    expect(extractPharmacyIdFromSearchRes('walgreens drug store #10728', PARSED_ADDRESS, ERX_RESULTS)).toBe(
      EXPECTED_ERX_ID
    );
  });

  it('returns a string (not a number) for the id', () => {
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, PARSED_ADDRESS, ERX_RESULTS);
    expect(typeof result).toBe('string');
  });

  it('matches when erx zipCode has a +4 extension and places zipCode does not', () => {
    // erx result zipCode is '11572-2225', places address zipCode is '11572' — first 5 must match
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, PARSED_ADDRESS, ERX_RESULTS);
    expect(result).toBe(EXPECTED_ERX_ID);
  });

  it('returns undefined when the pharmacy name does not match any result', () => {
    const result = extractPharmacyIdFromSearchRes('CVS Pharmacy', PARSED_ADDRESS, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when the address does not match any result', () => {
    const differentAddress = { ...PARSED_ADDRESS, city: 'Brooklyn', stateShort: 'NY', zipCode: '11201' };
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, differentAddress, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when placesPharmacyAddress is undefined', () => {
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, undefined, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when erxSearchResults is undefined', () => {
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, PARSED_ADDRESS, undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined when erxSearchResults is empty', () => {
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, PARSED_ADDRESS, []);
    expect(result).toBeUndefined();
  });

  it('returns undefined when name matches but city does not', () => {
    const wrongCity = { ...PARSED_ADDRESS, city: 'Freeport' };
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, wrongCity, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when name matches but state does not', () => {
    const wrongState = { ...PARSED_ADDRESS, stateShort: 'CA', stateLong: 'California' };
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, wrongState, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when name matches but zip does not', () => {
    const wrongZip = { ...PARSED_ADDRESS, zipCode: '90210' };
    const result = extractPharmacyIdFromSearchRes(PLACES_NAME, wrongZip, ERX_RESULTS);
    expect(result).toBeUndefined();
  });

  it('returns undefined when name is undefined', () => {
    const result = extractPharmacyIdFromSearchRes(undefined, PARSED_ADDRESS, ERX_RESULTS);
    expect(result).toBeUndefined();
  });
});
