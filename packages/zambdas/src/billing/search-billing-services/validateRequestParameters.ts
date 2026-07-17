import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchBillingServicesInput,
  SearchBillingServicesInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingServicesParams extends SearchBillingServicesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingServicesParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(SearchBillingServicesInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
