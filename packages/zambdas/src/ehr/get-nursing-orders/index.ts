import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { GetNursingOrdersInputValidated, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../shared';
import { getNursingOrderResources, mapResourcesNursingOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

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
    await topLevelCatch('get-nursing-orders', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching nursing orders: ${error}` }),
    };
  }
});
