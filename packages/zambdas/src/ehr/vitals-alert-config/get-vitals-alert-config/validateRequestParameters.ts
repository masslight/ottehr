import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

export interface ValidatedParams {
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return { secrets: input.secrets };
}
