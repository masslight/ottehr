import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  return { secrets: input.secrets };
}
