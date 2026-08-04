import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;

  return { secrets };
}
