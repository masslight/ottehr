import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { compareDates, EMPTY_PAGINATION, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../shared';
import { getInHouseResources, mapResourcesToInHouseOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');

    const oystehr = createOystehrClient(m2mToken, secrets);

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
      m2mToken
    );

    if (!serviceRequests.length) {
      console.log('no serviceRequests found, returning empty data array');
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: [],
          pagination: EMPTY_PAGINATION,
          ...(searchBy.field === 'patientId' && { patientLabItems: [] }),
        }),
      };
    }

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
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
      ENVIRONMENT,
      currentPractitioner,
      timezone
    );
    const sortedOrders = inHouseOrders.sort((a, b) => compareDates(a.orderAddedDate, b.orderAddedDate));

    if (searchBy.field === 'serviceRequestId') {
      return {
        statusCode: 200,
        body: JSON.stringify(sortedOrders || []),
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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('get-in-house-orders', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error fetching in-house orders: ${error.message || error}`,
        data: [],
        pagination: EMPTY_PAGINATION,
      }),
    };
  }
});
