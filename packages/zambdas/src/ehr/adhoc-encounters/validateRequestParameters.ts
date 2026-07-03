import { AdHocEncountersInput, AdHocEncountersInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): AdHocEncountersInput & { secrets: Secrets } {
  return validateWithSchema(AdHocEncountersInputSchema, input);
}
