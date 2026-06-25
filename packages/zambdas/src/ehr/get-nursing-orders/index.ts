import { APIGatewayProxyResult } from 'aws-lambda';
import { GetNursingOrdersInputValidated } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { getNursingOrderResources, mapResourcesNursingOrderDTOs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

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

  const { secrets, searchBy } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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
});
