import { GetBillingRulesInput, GetBillingRulesInputSchema, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetBillingRulesParams extends GetBillingRulesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingRulesParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  // `engine` defaults to the Claim Submission engine, so a body-less request stays valid (clients
  // predating the multi-engine split send none).
  const raw = input.body ? validateJsonBody(input) : {};
  const data = safeValidate(GetBillingRulesInputSchema, raw);

  return {
    ...data,
    secrets: input.secrets,
  };
}
