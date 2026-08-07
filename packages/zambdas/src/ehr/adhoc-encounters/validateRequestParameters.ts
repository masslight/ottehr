import { Secrets } from 'utils/lib/secrets';
import { AdHocEncountersInput, AdHocEncountersInputSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): AdHocEncountersInput & { secrets: Secrets } {
  const parsed = validateWithSchema(AdHocEncountersInputSchema, input);

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = parsed.secrets;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw MISSING_REQUEST_SECRETS;
  }

  return parsed;
}
