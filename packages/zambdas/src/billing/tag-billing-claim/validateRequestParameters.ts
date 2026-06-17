import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, TagBillingClaimInput, TagBillingClaimInputSchema } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface TagBillingClaimParams extends TagBillingClaimInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): TagBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(TagBillingClaimInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
