import { GetBillingRulesInput, GetBillingRulesInputSchema } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

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
