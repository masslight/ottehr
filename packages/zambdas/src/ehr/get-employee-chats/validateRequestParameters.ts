import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { getUserToken } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';

export interface GetEmployeeChatsInputValidated {
  secrets: Secrets;
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): GetEmployeeChatsInputValidated {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }
  return { secrets: input.secrets, userToken: getUserToken(input) };
}
