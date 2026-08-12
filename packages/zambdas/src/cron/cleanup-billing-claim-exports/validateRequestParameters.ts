import { MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export interface CleanupBillingClaimExportsParams {
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): CleanupBillingClaimExportsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return { secrets: input.secrets };
}
