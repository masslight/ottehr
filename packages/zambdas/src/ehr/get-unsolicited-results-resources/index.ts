import { APIGatewayProxyResult } from 'aws-lambda';
import {
  APIError,
  getSecret,
  GetUnsolicitedResultsResourcesOutput,
  isApiError,
  SecretsKeys,
  UnsolicitedResultsRequestType,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  handleGetPossibleRelatedRequestsToUnsolicitedResult,
  handleGetTasks,
  handleIconResourceRequest,
  handleUnsolicitedRequestMatch,
  handleUnsolicitedResultDetailRequest,
  handleUnsolicitedResultPatientListRequest,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-unsolicited-results-resources';

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

    let response: GetUnsolicitedResultsResourcesOutput | null;

    switch (requestType) {
      case UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_ICON: {
        console.log('handling unsolicited-results-icon request');
        response = await handleIconResourceRequest(oystehr);
        break;
      }
      case UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_TASKS: {
        console.log('handling get-unsolicited-results-tasks request');
        response = await handleGetTasks(oystehr);
        break;
      }
      case UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS: {
        console.log('handling match-unsolicited-result request');
        response = await handleUnsolicitedRequestMatch(oystehr, validatedParameters.diagnosticReportId);
        break;
      }
      case UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS: {
        console.log('handling get-unsolicited-result-related-requests request');
        response = await handleGetPossibleRelatedRequestsToUnsolicitedResult(
          oystehr,
          validatedParameters.diagnosticReportId,
          validatedParameters.patientId
        );
        break;
      }
      case UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_DETAIL: {
        console.log('handling unsolicited-results-detail request');
        response = await handleUnsolicitedResultDetailRequest(
          oystehr,
          validatedParameters.diagnosticReportId,
          m2mToken
        );
        break;
      }
      case UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_PATIENT_LIST: {
        console.log('handling unsolicited-results-patient-list request');
        response = await handleUnsolicitedResultPatientListRequest(oystehr, validatedParameters.patientId);
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
    let body = JSON.stringify({ message: `Error getting unsolicited result resources: ${error}` });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});
