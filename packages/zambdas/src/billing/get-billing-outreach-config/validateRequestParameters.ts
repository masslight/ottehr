import { Secrets } from 'utils/lib/secrets';
import { MISCONFIGURED_ENVIRONMENT_ERROR, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!isOutreachInBillingApp(input.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }
  return { secrets: input.secrets };
}
