import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, GetUnsolicitedResultsResourcesOutput, SecretsKeys, UnsolicitedResultsRequestType } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { handleGetTasks, handleRequestForIcon } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get unsolicited results resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { requestType, secrets } = validatedParameters;
    console.log('requestType: ', requestType);

    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    let response: GetUnsolicitedResultsResourcesOutput | undefined;

    switch (requestType) {
      case UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_ICON: {
        console.log('handling unsolicited-results-icon request');
        response = await handleRequestForIcon(oystehr);
        break;
      }
      case UnsolicitedResultsRequestType.GET_ALL_TASKS: {
        console.log('handling get-tasks request');
        response = await handleGetTasks(oystehr);
        break;
      }
      default: {
        throw Error('request type invalid');
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error getting unsolicited result resources: ${error}` }),
    };
  }
});
