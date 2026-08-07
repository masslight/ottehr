import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;

  return { secrets };
}
