import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = input.secrets;

  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw MISSING_REQUEST_SECRETS;
  }

  return { secrets: input.secrets };
}
