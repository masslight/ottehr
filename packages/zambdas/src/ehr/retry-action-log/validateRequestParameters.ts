import {
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  RetryActionLogInputSchema,
  RetryActionLogInputValidated,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): RetryActionLogInputValidated {
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;
  if (!input.body) throw MISSING_REQUEST_BODY;
  return { ...safeValidate(RetryActionLogInputSchema, safeJsonParse(input.body)), secrets: input.secrets };
}
