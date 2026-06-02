import { MISSING_AUTH_TOKEN, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  const secrets = input.secrets;
  return { secrets };
}
