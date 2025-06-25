import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getNoursingOrderResources, mapResourcesNursingOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('get-nursing-orders', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { secrets, searchBy } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { serviceRequests, tasks, practitioners, provenances } = await getNoursingOrderResources(
      oystehr,
      validatedParameters
    );

    if (!serviceRequests.length) {
      console.log('no serviceRequests found, returning empty data array');
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
        }),
      };
    }

    const nursingOrders = mapResourcesNursingOrderDTOs(serviceRequests, tasks, practitioners, provenances, searchBy);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: nursingOrders,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('get-nursing-orders', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching nursing orders: ${error}` }),
    };
  }
});
