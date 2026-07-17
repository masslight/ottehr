import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  RunBillingRulesEngineInput,
  RunBillingRulesEngineInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface RunBillingRulesEngineParams extends RunBillingRulesEngineInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): RunBillingRulesEngineParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(RunBillingRulesEngineInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
