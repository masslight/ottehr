import { Secrets } from 'utils/lib/secrets';
import { MISSING_AUTH_TOKEN } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  if (!input.headers?.Authorization) {
    throw MISSING_AUTH_TOKEN;
  }

  return { secrets: input.secrets };
}
