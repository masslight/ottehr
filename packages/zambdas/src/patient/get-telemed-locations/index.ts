import { APIGatewayProxyResult } from 'aws-lambda';
import { getTelemedLocations } from 'utils/lib/fhir/location';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { GetTelemedLocationsResponse } from 'utils/lib/types/data/telemed/get-telemed-locations.types';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
let oystehrToken: string;
const ZAMBDA_NAME = 'get-telemed-locations';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
});
