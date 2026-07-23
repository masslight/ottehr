import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  RecordBillingManualPaymentInput,
  RecordBillingManualPaymentInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

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
