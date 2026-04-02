import { MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../../../shared';

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
