import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  RecordBillingPaymentInput,
  RecordBillingPaymentInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface RecordBillingPaymentParams extends RecordBillingPaymentInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): RecordBillingPaymentParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(RecordBillingPaymentInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
