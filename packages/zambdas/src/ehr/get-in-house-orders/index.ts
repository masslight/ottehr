import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
// import { mapResourcesToInHouseOrderDTOs } from './helpers';
import { EMPTY_PAGINATION, GetInHouseOrdersParameters, Secrets } from 'utils'; // InHouseOrderDTO
import { checkOrCreateM2MClientToken } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');

    let validatedParameters: GetInHouseOrdersParameters & { secrets: Secrets | null; userToken: string };

    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          data: [],
          pagination: EMPTY_PAGINATION,
        }),
      };
    }

    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    // const oystehr = createOystehrClient(m2mtoken, secrets);

    // const {
    //   serviceRequests,
    //   tasks,
    //   diagnosticReports,
    //   practitioners,
    //   pagination,
    //   encounters,
    //   locations,
    //   appointments,
    //   provenances,
    //   organizations,
    //   questionnaires,
    //   labPDFs,
    //   specimens,
    // } = await getLabResources(oystehr, validatedParameters, m2mtoken, {
    //   searchBy: validatedParameters.searchBy,
    // });

    // if (!serviceRequests.length) {
    //   return {
    //     statusCode: 200,
    //     body: JSON.stringify({
    //       data: [],
    //       pagination: EMPTY_PAGINATION,
    //     }),
    //   };
    // }

    // const labOrders = mapResourcesToLabOrderDTOs(
    //   { searchBy },
    //   serviceRequests,
    //   tasks,
    //   diagnosticReports,
    //   practitioners,
    //   encounters,
    //   locations,
    //   appointments,
    //   provenances,
    //   organizations,
    //   questionnaires,
    //   labPDFs,
    //   specimens
    // );

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {}, // todo: use real data
        // pagination,
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
