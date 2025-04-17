import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { getLabResources, mapResourcesToLabOrderDTOs } from './helpers';
import { EMPTY_PAGINATION } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequests,
      tasks,
      diagnosticReports,
      practitioners,
      pagination,
      encounters,
      appointments,
      provenances,
      organizations,
    } = await getLabResources(oystehr, validatedParameters);

    if (!serviceRequests.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const labOrders = mapResourcesToLabOrderDTOs(
      serviceRequests,
      tasks,
      diagnosticReports,
      practitioners,
      encounters,
      appointments,
      provenances,
      organizations
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: labOrders,
        pagination,
      }),
    };
  } catch (error: any) {
    await topLevelCatch('get-lab-orders', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching lab orders: ${error}` }),
    };
  }
};
