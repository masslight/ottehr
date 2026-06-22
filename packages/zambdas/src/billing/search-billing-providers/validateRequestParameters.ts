import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchBillingProvidersInput,
  SearchBillingProvidersInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingProvidersParams extends SearchBillingProvidersInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingProvidersParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SearchBillingProvidersInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
