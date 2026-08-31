import { CreateBillingClaimInput, CreateBillingClaimInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface CreateClaimParams extends CreateBillingClaimInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingClaimInputSchema, validateJsonBody(input));
  // coverageId is optional — self-pay claims are represented with a no-coverage stub in Claim.insurance.

  return {
    ...data,
    secrets: input.secrets,
  };
}
