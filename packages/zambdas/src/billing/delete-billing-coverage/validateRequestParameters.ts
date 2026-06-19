import {
  DeleteBillingCoverageInput,
  DeleteBillingCoverageInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface DeleteBillingCoverageParams extends DeleteBillingCoverageInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteBillingCoverageParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(DeleteBillingCoverageInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
