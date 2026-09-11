import { Secrets } from 'utils/lib/secrets';
import {
  CreateTimelyFilingReportInput,
  CreateTimelyFilingReportInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface CreateTimelyFilingReportParams extends CreateTimelyFilingReportInput {
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): CreateTimelyFilingReportParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateTimelyFilingReportInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
