import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getSecret, getTelemedLocations, GetTelemedLocationsResponse, SecretsKeys } from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';
let oystehrToken: string;
export const index = wrapHandler(
  'get-telemed-locations',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
      const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);

      if (!oystehrToken) {
        console.log('getting m2m token for service calls');
        oystehrToken = await getAuth0Token(input.secrets);
      } else {
        console.log('already have a token, no need to update');
      }

      const oystehr = createOystehrClient(oystehrToken, fhirAPI, projectAPI);

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
  }
);
