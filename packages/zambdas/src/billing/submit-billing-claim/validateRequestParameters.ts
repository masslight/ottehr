import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SubmitBillingClaimsInput,
  SubmitBillingClaimsInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SubmitBillingClaimsParams extends SubmitBillingClaimsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SubmitBillingClaimsParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SubmitBillingClaimsInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
