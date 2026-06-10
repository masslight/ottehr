import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }
  return { secrets: input.secrets };
}
