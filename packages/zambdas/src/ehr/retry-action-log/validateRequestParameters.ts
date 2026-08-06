import { RetryActionLogInputSchema, RetryActionLogInputValidated } from 'utils/lib/types/api/action-logs.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): RetryActionLogInputValidated {
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;
  if (!input.body) throw MISSING_REQUEST_BODY;
  return { ...safeValidate(RetryActionLogInputSchema, safeJsonParse(input.body)), secrets: input.secrets };
}
