import { GetBillingReportInput, GetBillingReportInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface GetBillingReportParams extends GetBillingReportInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingReportParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetBillingReportInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
