import { Secrets } from 'utils/lib/secrets';
import { RunFetchPlanInput, RunFetchPlanInputSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export type ValidatedParams = RunFetchPlanInput & { secrets: Secrets };

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(RunFetchPlanInputSchema, safeJsonParse(input.body));
  return { ...parsed, secrets: input.secrets };
}
