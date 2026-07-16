import { GetFaxLogsInputSchema, GetFaxLogsInputValidated, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetFaxLogsInputValidated {
  if (input.headers?.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeJsonParse(input.body);
  const validated = safeValidate(GetFaxLogsInputSchema, data);

  return { ...validated, secrets: input.secrets };
}
