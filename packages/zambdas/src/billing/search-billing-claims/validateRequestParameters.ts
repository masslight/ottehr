import { MISSING_REQUEST_SECRETS, SearchBillingClaimsInput, SearchBillingClaimsInputSchema } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingClaimsParams extends SearchBillingClaimsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingClaimsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingClaimsInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
