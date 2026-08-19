import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';

export interface CleanupBillingClaimExportsParams {
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): CleanupBillingClaimExportsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return { secrets: input.secrets };
}
