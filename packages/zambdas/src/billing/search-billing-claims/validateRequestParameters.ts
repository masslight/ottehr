import { MISSING_REQUEST_SECRETS, SearchBillingClaimsInput, SearchBillingClaimsInputSchema } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SearchBillingClaimsParams extends SearchBillingClaimsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingClaimsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingClaimsInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
