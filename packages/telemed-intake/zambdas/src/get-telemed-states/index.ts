import { FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4';
import {
  createFhirClient,
  getSecret,
  GetTelemedLocationsResponse,
  PUBLIC_EXTENSION_BASE_URL,
  SecretsKeys,
  TelemedLocation,
  ZambdaInput,
} from 'ottehr-utils';
import { getM2MClientToken } from '../shared';

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getM2MClientToken(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const fhirClient = createFhirClient(zapehrToken, fhirAPI);

    const telemedLocations = await getTelemedLocations(fhirClient);

    if (!telemedLocations) {
      return {
        statusCode: 200,
        body: JSON.stringify({ locations: [] }),
      };
    }

    const response: GetTelemedLocationsResponse = {
      locations: telemedLocations,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Failed to get telemed states', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error while fetching telemed states' }),
    };
  }
};

async function getTelemedLocations(fhirClient: FhirClient): Promise<TelemedLocation[] | undefined> {
  const resources = await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [],
  });

  const telemedLocations = (resources as Location[]).filter((location) =>
    location.extension?.some(
      (ext) => ext.url === `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release` && ext.valueCoding?.code === 'vi',
    ),
  );

  return telemedLocations.map((location) => ({
    state: location.address?.state || '',
    // available: location.status === 'active',
    available: true,
  }));
}
