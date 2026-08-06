import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import {
  RecordBillingManualPaymentInput,
  RecordBillingManualPaymentInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

export interface RecordBillingManualPaymentParams extends RecordBillingManualPaymentInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): RecordBillingManualPaymentParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(RecordBillingManualPaymentInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
