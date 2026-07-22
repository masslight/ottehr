import { GetBillingRulesInput, GetBillingRulesInputSchema, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetBillingRulesParams extends GetBillingRulesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingRulesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetBillingRulesInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
