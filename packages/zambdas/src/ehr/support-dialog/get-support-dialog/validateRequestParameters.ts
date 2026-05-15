import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null; userToken: string } {
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;
  return { secrets, userToken };
}
