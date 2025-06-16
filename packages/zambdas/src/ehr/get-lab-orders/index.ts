import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { getLabResources, mapResourcesToLabOrderDTOs } from './helpers';
import { EMPTY_PAGINATION } from 'utils';
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

    const {
      serviceRequests,
      tasks,
      diagnosticReports,
      practitioners,
      pagination,
      encounters,
      locations,
      appointments,
      provenances,
      organizations,
      questionnaires,
      labPDFs,
      specimens,
      patientLabItems,
    } = await getLabResources(oystehr, validatedParameters, m2mtoken, {
      searchBy: validatedParameters.searchBy,
    });

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

    const labOrders = mapResourcesToLabOrderDTOs(
      { searchBy },
      serviceRequests,
      tasks,
      diagnosticReports,
      practitioners,
      encounters,
      locations,
      appointments,
      provenances,
      organizations,
      questionnaires,
      labPDFs,
      specimens,
      secrets
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: labOrders,
        pagination,
        ...(patientLabItems && { patientLabItems }),
      }),
    };
  } catch (error: any) {
    await topLevelCatch('get-lab-orders', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error fetching external lab orders: ${error}` }),
    };
  }
};
