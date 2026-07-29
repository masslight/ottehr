import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchBillingPatientARClaimsInput,
  SearchBillingPatientARClaimsInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingPatientARClaimsParams extends SearchBillingPatientARClaimsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPatientARClaimsParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SearchBillingPatientARClaimsInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
