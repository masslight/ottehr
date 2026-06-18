import {
  CreateBillingClaimInput,
  CreateBillingClaimInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface CreateClaimParams extends CreateBillingClaimInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingClaimInputSchema, validateJsonBody(input));
  // FHIR requires Claim.insurance/insurer — a claim can't be created without a coverage.
  if (!data.coverageId) throw INVALID_INPUT_ERROR('Select an insurance/coverage for the claim');

  return {
    ...data,
    secrets: input.secrets,
  };
}
