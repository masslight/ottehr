import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  return {
    secrets,
    userToken,
  };
}
