import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import {
  getAllFhirSearchPages,
  GetLocationSupportPhonesOutput,
  getSecret,
  LOCATION_SUPPORT_PHONE_EXTENSION_URL,
  LocationSupportPhoneEntry,
  SecretsKeys,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-public-location-support-phones';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    const { secrets } = input;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);

    const response = await performEffect(oystehr);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (oystehr: Oystehr): Promise<GetLocationSupportPhonesOutput> => {
  const locations = await getAllFhirSearchPages<Location>({ resourceType: 'Location' }, oystehr);

  const entries: LocationSupportPhoneEntry[] = locations
    .map((loc) => {
      const phoneNumber = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
      if (!loc.id || !loc.name || !phoneNumber) return undefined;
      return { locationId: loc.id, locationName: loc.name, phoneNumber };
    })
    .filter((e): e is LocationSupportPhoneEntry => e !== undefined);

  return { locations: entries };
};
