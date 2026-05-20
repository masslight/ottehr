import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import {
  getAllFhirSearchPages,
  GetLocationSupportPhonesOutput,
  LOCATION_SUPPORT_PHONE_EXTENSION_URL,
  LocationSupportPhoneEntry,
} from 'utils';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-public-location-support-phones';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }
  const oystehr = createOystehrClient(oystehrToken, secrets);

  const locations = await getAllFhirSearchPages<Location>({ resourceType: 'Location' }, oystehr);

  const entries: LocationSupportPhoneEntry[] = locations
    .map((loc) => {
      const phoneNumber = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
      if (!loc.id || !loc.name || !phoneNumber) return undefined;
      return { locationId: loc.id, locationName: loc.name, phoneNumber };
    })
    .filter((e): e is LocationSupportPhoneEntry => e !== undefined);

  const response: GetLocationSupportPhonesOutput = {
    locations: entries,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
