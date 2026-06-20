import { MISSING_AUTH_TOKEN, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null; userToken: string } {
  const authorization = input.headers?.Authorization;
  if (!authorization) {
    throw MISSING_AUTH_TOKEN;
  }
  const userToken = authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  return { secrets, userToken };
}
