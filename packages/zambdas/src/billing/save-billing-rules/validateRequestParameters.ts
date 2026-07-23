import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SaveBillingRulesInput,
  SaveBillingRulesInputSchema,
  validateRuleFieldReferences,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SaveBillingRulesParams extends SaveBillingRulesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SaveBillingRulesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SaveBillingRulesInputSchema, validateJsonBody(input));

  // The schema validates rule structure; the field catalog validates references. The rule builder
  // only offers catalog fields, so this mainly guards API-created rules against typos and read-only
  // targets — the engine would fail safe at runtime, but rejecting at save time surfaces it now.
  const problems = data.rules.flatMap((rule) => validateRuleFieldReferences(rule));
  if (problems.length > 0) throw INVALID_INPUT_ERROR(problems.join('; '));

  return {
    ...data,
    secrets: input.secrets,
  };
}
