import { GetActionLogsInputSchema, GetActionLogsInputValidated, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetActionLogsInputValidated {
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;
  if (!input.body) throw MISSING_REQUEST_BODY;
  return { ...safeValidate(GetActionLogsInputSchema, safeJsonParse(input.body)), secrets: input.secrets };
}
