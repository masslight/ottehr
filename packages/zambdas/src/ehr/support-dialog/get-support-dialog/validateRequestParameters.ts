import { Secrets } from 'utils/lib/secrets';
import { MISSING_AUTH_TOKEN } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null; userToken: string } {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;
  return { secrets, userToken };
}
