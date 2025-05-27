import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { getInHouseResources, mapResourcesToInHouseOrderDTOs } from './helpers';
import { EMPTY_PAGINATION } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.group('validateRequestParameters');

    let validatedParameters;
    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      console.groupEnd();
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Invalid request parameters. ${error.message || error}`,
          data: [],
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const { secrets, searchBy } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');

    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequests,
      tasks,
      practitioners,
      encounters,
      appointments,
      provenances,
      activityDefinitions,
      specimens,
      observations,
      pagination,
      diagnosticReports,
      resultsPDFs,
      currentPractitioner,
      timezone,
    } = await getInHouseResources(
      oystehr,
      validatedParameters,
      {
        searchBy: validatedParameters.searchBy,
      },
      userToken,
      m2mtoken
    );

    if (!serviceRequests.length) {
      console.log('no serviceRequests found, returning empty data array');
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const inHouseOrders = mapResourcesToInHouseOrderDTOs(
      { searchBy },
      serviceRequests,
      tasks,
      practitioners,
      encounters,
      appointments,
      provenances,
      activityDefinitions,
      specimens,
      observations,
      diagnosticReports,
      resultsPDFs,
      currentPractitioner,
      timezone
    );

    // For detail requests, return single item without pagination
    if (searchBy.field === 'serviceRequestId') {
      return {
        statusCode: 200,
        body: JSON.stringify(inHouseOrders?.[0] || {}),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: inHouseOrders,
        pagination,
      }),
    };
  } catch (error: any) {
    await topLevelCatch('get-in-house-orders', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error fetching in-house orders: ${error.message || error}`,
        data: [],
        pagination: EMPTY_PAGINATION,
      }),
    };
  }
};
