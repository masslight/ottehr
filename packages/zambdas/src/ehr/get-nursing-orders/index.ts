import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { getNoursingOrderResources, mapResourcesNursingOrderDTOs } from './helpers';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, searchBy } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

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
    await topLevelCatch('get-nursing-orders', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching nursing orders: ${error}` }),
    };
  }
};
