import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, SaveBillingTagInput, SaveBillingTagInputSchema } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SaveBillingTagParams extends SaveBillingTagInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SaveBillingTagParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SaveBillingTagInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
