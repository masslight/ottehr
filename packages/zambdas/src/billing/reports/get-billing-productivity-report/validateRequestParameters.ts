import {
  GetBillingProductivityReportInput,
  GetBillingProductivityReportInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface GetBillingProductivityReportParams extends GetBillingProductivityReportInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingProductivityReportParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(GetBillingProductivityReportInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
