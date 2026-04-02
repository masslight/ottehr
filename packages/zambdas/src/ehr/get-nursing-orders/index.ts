import { APIGatewayProxyResult } from 'aws-lambda';
import { GetNursingOrdersInputValidated, getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { getNursingOrderResources, mapResourcesNursingOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('get-nursing-orders', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`get-nursing-orders started, input: ${JSON.stringify(input)}`);

  let validatedParameters: GetNursingOrdersInputValidated;

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    const { secrets, searchBy } = validatedParameters;
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const { serviceRequests, tasks, practitioners, provenances, encounters } = await getNursingOrderResources(
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

    const nursingOrders = mapResourcesNursingOrderDTOs(
      serviceRequests,
      tasks,
      practitioners,
      provenances,
      encounters,
      searchBy
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: nursingOrders,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-nursing-orders', error, ENVIRONMENT);
  }
});
