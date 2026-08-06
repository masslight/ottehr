import { UserActivationZambdaInputSchema } from 'utils/lib/types/api/user-activation.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { UserActivationZambdaInputValidated } from './index';

export function validateRequestParameters(input: ZambdaInput): UserActivationZambdaInputValidated {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = safeJsonParse(input.body);
  const { userActivationMode, userId } = safeValidate(UserActivationZambdaInputSchema, parsedJSON);

  return {
    userId,
    userActivationMode,
    secrets: input.secrets,
  };
}
