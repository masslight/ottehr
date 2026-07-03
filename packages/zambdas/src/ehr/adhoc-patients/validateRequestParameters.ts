import { AdHocPatientsInput, AdHocPatientsInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): AdHocPatientsInput & { secrets: Secrets } {
  return validateWithSchema(AdHocPatientsInputSchema, input);
}
