import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { UserActivationZambdaInputSchema } from 'utils/lib/types/api/user-activation.types';
import { safeValidate, ZambdaInput } from '../../shared';
import { UserActivationZambdaInputValidated } from './index';

export function validateRequestParameters(input: ZambdaInput): UserActivationZambdaInputValidated {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = JSON.parse(input.body);
  const { userActivationMode, userId } = safeValidate(UserActivationZambdaInputSchema, parsedJSON);

  return {
    userId,
    userActivationMode,
    secrets: input.secrets,
  };
}
