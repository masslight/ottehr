import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, PlacesResult, SearchPlacesInput, SearchPlacesOutput, SecretsKeys } from 'utils';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';
import {
  addressComponentsFromPlacesDetailRes,
  extractPharmacyIdFromSearchRes,
  getParamsForErxPharmacySearch,
  PLACES_API_BASE_URL,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'search-places';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    const { searchTerm, placesId, secrets } = validatedInput;

    const googleApiKey = getSecret(SecretsKeys.GOOGLE_PLACES_API_KEY, secrets);

    if (!oystehrToken) {
      console.log('getting m2m token for service calls');
      oystehrToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const output = await performEffect({ searchTerm, placesId, googleApiKey, oystehr });

    return {
      statusCode: 200,
      body: JSON.stringify(output),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

const performEffect = async (
  input: SearchPlacesInput & { googleApiKey: string; oystehr: Oystehr }
): Promise<SearchPlacesOutput> => {
  const { searchTerm, placesId, googleApiKey, oystehr } = input;

  const result: SearchPlacesOutput = { pharmacyPlaces: [] };

  if (searchTerm) {
    result.pharmacyPlaces = await searchPharmaciesWithPlaces(searchTerm, googleApiKey);
  } else if (placesId) {
    result.pharmacyPlaces = await getPharmacyDetail(placesId, googleApiKey, oystehr);
  }

  return result;
};

/**
 * Searches Places API Autocomplete
 * @param searchTerm
 * @param googleApiKey
 * @returns an array of PlacesResults (placeId, name & address)
 */
const searchPharmaciesWithPlaces = async (searchTerm: string, googleApiKey: string): Promise<PlacesResult[]> => {
  console.log('calling google places api with searchTerm', searchTerm);

  // https://developers.google.com/maps/documentation/places/web-service/place-types#table-a
  // https://developers.google.com/maps/documentation/places/web-service/place-types#table-b
  // the downside to this is if someone inputs just the address, nothing will be returned
  // we could include "street_address" as a type but I think we want to discourage typing JUST the address
  // because with the current logic we won't be able to match against the erx pharmacy search
  const includedPrimaryTypes = ['drugstore', 'pharmacy', 'hospital', 'doctor', 'health']; // there can be 5 max

  const response = await fetch(`${PLACES_API_BASE_URL}:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googleApiKey,
    },
    body: JSON.stringify({
      input: searchTerm,
      includedPrimaryTypes,
      languageCode: 'en',
    }),
  });

  console.log('received response');

  const data = await response.json();
  console.log('google api data:', JSON.stringify(data));

  const results: PlacesResult[] =
    data.suggestions?.map((s: any) => {
      const placesResultFormatted: PlacesResult = {
        placesId: s.placePrediction.placeId,
        name: s.placePrediction.structuredFormat.mainText.text,
        address: s.placePrediction.structuredFormat.secondaryText?.text ?? '',
      };
      return placesResultFormatted;
    }) ?? [];

  return results;
};

/**
 * Uses Places API Place Details and erx searchPharmacies to return a PlaceResult
 * @param placesId id returned from places autocomplete
 * @param googleApiKey
 * @param oystehr
 * @returns name, address and possibly an erxPharmacyId
 */
const getPharmacyDetail = async (placesId: string, googleApiKey: string, oystehr: Oystehr): Promise<PlacesResult[]> => {
  console.log('calling google places api with placesId', placesId);

  // in order to get the full address we need to call places for the place detail information
  const response = await fetch(`${PLACES_API_BASE_URL}/${placesId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googleApiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents',
    },
  });

  const data = await response.json();
  const placesName = data?.displayName?.text;
  const placesAddress = data?.formattedAddress;

  const addressParsed = addressComponentsFromPlacesDetailRes(data?.addressComponents);
  const pharmacySearchParams = getParamsForErxPharmacySearch(addressParsed, placesName);

  console.log('calling erx.searchPharmacies', JSON.stringify(pharmacySearchParams));
  const oystehrPharmacySearchRes = await oystehr.erx.searchPharmacies(pharmacySearchParams);
  console.log('oystehrPharmacySearchRes', oystehrPharmacySearchRes);

  const formattedPlace: PlacesResult = {
    placesId,
    name: placesName ?? '',
    address: placesAddress ?? '',
    erxPharmacyId: extractPharmacyIdFromSearchRes(placesName, addressParsed, oystehrPharmacySearchRes),
  };

  console.log('returning this formatted pharmacy info', JSON.stringify(formattedPlace));

  return [formattedPlace];
};
