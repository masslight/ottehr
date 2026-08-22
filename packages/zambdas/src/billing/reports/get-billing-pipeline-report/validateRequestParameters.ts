import {
  GetBillingPipelineReportInput,
  GetBillingPipelineReportInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface GetBillingPipelineReportParams extends GetBillingPipelineReportInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingPipelineReportParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(GetBillingPipelineReportInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
