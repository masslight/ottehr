import { MISSING_AUTH_TOKEN, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  if (!input.headers?.Authorization) {
    throw MISSING_AUTH_TOKEN;
  }

  return { secrets: input.secrets };
}
