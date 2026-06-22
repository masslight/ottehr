import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateBillingCoverageInput,
  UpdateBillingCoverageInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface UpdateBillingCoverageParams extends UpdateBillingCoverageInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateBillingCoverageParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UpdateBillingCoverageInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
