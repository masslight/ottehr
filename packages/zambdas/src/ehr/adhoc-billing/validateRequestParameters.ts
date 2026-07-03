import { AdHocBillingInput, AdHocBillingInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): AdHocBillingInput & { secrets: Secrets } {
  return validateWithSchema(AdHocBillingInputSchema, input);
}
