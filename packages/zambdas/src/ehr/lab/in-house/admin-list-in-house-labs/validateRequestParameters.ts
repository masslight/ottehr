import { AdminListInHouseLabsInput, Secrets } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): AdminListInHouseLabsInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminListInHouseLabsInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw new Error('Unable to parse request body. Invalid JSON.');
  }

  if (!params.userId) {
    throw new Error('No user id provided');
  }

  return {
    userId: params.userId,
    secrets,
    userToken,
  };
}
