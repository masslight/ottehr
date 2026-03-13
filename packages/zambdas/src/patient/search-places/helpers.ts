import { ErxSearchPharmaciesParams, ErxSearchPharmaciesResponse } from '@oystehr/sdk';

export const PLACES_API_BASE_URL = 'https://places.googleapis.com/v1/places';

type PlacesDetailAddress = {
  streetAddress: string | undefined;
  streetNumber: string | undefined;
  streetLong: string | undefined; // Pineapple Street
  streetShort: string | undefined; // Pineapple St
  city: string | undefined;
  stateLong: string | undefined; // New York
  stateShort: string | undefined; // NY
  zipCode: string | undefined;
  country: string | undefined;
};

// when searching the places detail api to retrieve specific components of an address you must include addressComponents in the fieldMask and iterate over the array returned
// https://developers.google.com/maps/documentation/javascript/geocoding#address-types
export const PlacesAddressComponentType = {
  streetAddress: 'street_address',
  streetNumber: 'street_number',
  street: 'route',
  city: 'locality',
  state: 'administrative_area_level_1',
  zipCode: 'postal_code',
  country: 'country',
};

export const addressComponentsFromPlacesDetailRes = (addressComponents: any): PlacesDetailAddress | undefined => {
  if (!Array.isArray(addressComponents)) return;

  const init: PlacesDetailAddress = {
    streetAddress: undefined,
    streetNumber: undefined,
    streetLong: undefined,
    streetShort: undefined,
    city: undefined,
    stateShort: undefined,
    stateLong: undefined,
    zipCode: undefined,
    country: undefined,
  };

  const addressComponentsParsed = addressComponents.reduce((acc: PlacesDetailAddress, component) => {
    const componentTypes = component.types;
    if (!Array.isArray(componentTypes)) return acc;

    const longName = component.longText;
    if (!longName) return acc;

    if (componentTypes.includes(PlacesAddressComponentType.streetAddress)) {
      acc.streetAddress = longName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.streetNumber)) {
      acc.streetNumber = longName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.street)) {
      acc.streetLong = longName;
      const shortName = component.shortText;
      if (shortName) acc.streetShort = shortName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.city)) {
      acc.city = longName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.state)) {
      acc.stateLong = longName;
      const shortName = component.shortText;
      if (shortName) acc.stateShort = shortName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.zipCode)) {
      acc.zipCode = longName;
    }

    if (componentTypes.includes(PlacesAddressComponentType.country)) {
      acc.country = longName;
    }

    return acc;
  }, init);

  return addressComponentsParsed;
};

export const getParamsForErxPharmacySearch = (
  addressParsed: PlacesDetailAddress | undefined,
  placesName: string
): ErxSearchPharmaciesParams => {
  const params: ErxSearchPharmaciesParams = {
    name: placesName,
  };

  if (!addressParsed) return params;

  if (addressParsed.streetNumber && addressParsed.streetLong) {
    params.address = `${addressParsed.streetNumber} ${addressParsed.streetLong}`;
  }
  if (addressParsed.stateShort) params.state = addressParsed.stateShort;
  if (addressParsed.city) params.city = addressParsed.city;
  if (addressParsed.zipCode) params.zipCode = addressParsed.zipCode;

  return params;
};

export const extractPharmacyIdFromSearchRes = (
  placesPharmacyName: string,
  placesPharmacyAddress: PlacesDetailAddress | undefined,
  erxSearchResults: ErxSearchPharmaciesResponse
): string | undefined => {
  if (!placesPharmacyAddress) return;
  if (!erxSearchResults.data.length) return;

  const match = erxSearchResults.data.find((res) => {
    const nameMatch = namePartialMatch(res.name, placesPharmacyName);
    const addressMatch = addressExactMatch(res, placesPharmacyAddress);

    return nameMatch && addressMatch;
  });

  console.log('extractPharmacyIdFromSearchRes match: ', match);

  return match?.id.toString();
};

const namePartialMatch = (name1: string, name2: string): boolean => {
  name1 = name1.toLowerCase();
  name2 = name2.toLowerCase();

  return name1 === name2 || name1.includes(name2) || name2.includes(name1);
};

const addressExactMatch = (
  erxResult: ErxSearchPharmaciesResponse['data'][number],
  placesPharmacyAddress: PlacesDetailAddress
): boolean => {
  const placesStreetAddressShort = `${
    placesPharmacyAddress.streetNumber
  } ${placesPharmacyAddress.streetShort?.toLowerCase()}`;
  const placesStreetAddressLong = `${
    placesPharmacyAddress.streetNumber
  } ${placesPharmacyAddress.streetLong?.toLowerCase()}`;
  const addressMatches =
    erxResult.address1.toLocaleLowerCase() === placesStreetAddressShort ||
    erxResult.address1.toLocaleLowerCase() === placesStreetAddressLong;

  const cityMatches = erxResult.city.toLowerCase() === placesPharmacyAddress.city?.toLowerCase();

  const stateMatches =
    erxResult.state.toLowerCase() === placesPharmacyAddress.stateShort?.toLowerCase() ||
    erxResult.state.toLowerCase() === placesPharmacyAddress.stateLong?.toLowerCase();

  const zipFirstFiveMatches = erxResult.zipCode.slice(0, 5) === placesPharmacyAddress.zipCode?.slice(0, 5);

  return addressMatches && cityMatches && stateMatches && zipFirstFiveMatches;
};
