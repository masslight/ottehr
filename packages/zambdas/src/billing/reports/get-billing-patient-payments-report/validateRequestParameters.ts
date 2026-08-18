import {
  GetBillingPatientPaymentsReportInput,
  GetBillingPatientPaymentsReportInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface GetBillingPatientPaymentsReportParams extends GetBillingPatientPaymentsReportInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingPatientPaymentsReportParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(GetBillingPatientPaymentsReportInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
