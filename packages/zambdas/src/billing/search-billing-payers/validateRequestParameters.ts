import { MISSING_REQUEST_SECRETS, SearchBillingPayersInput, SearchBillingPayersInputSchema } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SearchBillingPayersParams extends SearchBillingPayersInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPayersParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingPayersInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
