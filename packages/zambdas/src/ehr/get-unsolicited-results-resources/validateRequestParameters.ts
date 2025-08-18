import { GetUnsolicitedResultsResourcesInput, Secrets, UnsolicitedResultsRequestType } from 'utils';
import { ZambdaInput } from '../../shared';

// todo sarah do real validation here lol
export function validateRequestParameters(
  input: ZambdaInput
): GetUnsolicitedResultsResourcesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { requestType } = JSON.parse(input.body);

  const validRequestTypes = Object.values(UnsolicitedResultsRequestType);
  if (!validRequestTypes.includes(requestType)) {
    throw new Error(`Invalid requestType: ${requestType}`);
  }

  return {
    requestType,
    secrets: input.secrets,
  };
}
