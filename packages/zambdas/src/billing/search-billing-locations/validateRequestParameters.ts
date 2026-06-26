import { MISSING_REQUEST_SECRETS, SearchBillingLocationsInput, SearchBillingLocationsInputSchema } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingLocationsParams extends SearchBillingLocationsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingLocationsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingLocationsInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
