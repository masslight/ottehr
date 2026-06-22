import {
  CreateBillingCoverageInput,
  CreateBillingCoverageInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface CreateBillingCoverageParams extends CreateBillingCoverageInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateBillingCoverageParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingCoverageInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
