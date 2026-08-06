import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { SaveBillingRulesInput, SaveBillingRulesInputSchema } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { validateRuleFieldReferences } from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

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
