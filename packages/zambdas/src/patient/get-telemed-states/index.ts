import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { GetTelemedLocationsResponse, PUBLIC_EXTENSION_BASE_URL, TelemedLocation, createOystehrClient } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret } from 'zambda-utils';
import { getAuth0Token } from '../shared';

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);

    const telemedLocations = await getTelemedLocations(oystehr);

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

async function getTelemedLocations(oystehr: Oystehr): Promise<TelemedLocation[] | undefined> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [],
    })
  ).unbundle();

  const telemedLocations = resources.filter(
    (location) =>
      location.extension?.some(
        (ext) => ext.url === `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release` && ext.valueCoding?.code === 'vi'
      )
  );

  return telemedLocations.map((location) => ({
    state: location.address?.state || '',
    available: location.status === 'active',
  }));
}
