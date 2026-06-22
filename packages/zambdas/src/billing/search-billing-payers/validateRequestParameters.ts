import { MISSING_REQUEST_SECRETS, SearchBillingPayersInput, SearchBillingPayersInputSchema } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingPayersParams extends SearchBillingPayersInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPayersParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingPayersInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
