import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchBillingProcedureCodesInput,
  SearchBillingProcedureCodesInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchBillingProcedureCodesParams extends SearchBillingProcedureCodesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingProcedureCodesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SearchBillingProcedureCodesInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
