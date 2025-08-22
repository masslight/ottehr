import { GetUnsolicitedResultsResourcesInput, Secrets, UnsolicitedResultsRequestType } from 'utils';
import { ZambdaInput } from '../../shared';

// todo sarah do real validation here lol
export function validateRequestParameters(
  input: ZambdaInput
): GetUnsolicitedResultsResourcesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { requestType, diagnosticReportId, patientId } = JSON.parse(input.body);

  const validRequestTypes = Object.values(UnsolicitedResultsRequestType);
  if (!validRequestTypes.includes(requestType)) {
    throw new Error(`Invalid requestType: ${requestType}`);
  }

  if (
    requestType === UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS ||
    requestType === UnsolicitedResultsRequestType.GET_UR_RELATED_REQUESTS
  ) {
    if (!diagnosticReportId || typeof diagnosticReportId !== 'string') {
      throw Error(`diagnosticReportId is an unexpected type: ${diagnosticReportId}`);
    }
  }

  if (requestType === UnsolicitedResultsRequestType.GET_UR_RELATED_REQUESTS) {
    if (!patientId || typeof patientId !== 'string') {
      throw Error(`patientId is an unexpected type: ${patientId}`);
    }
  }

  return {
    requestType,
    diagnosticReportId,
    patientId,
    secrets: input.secrets,
  };
}
