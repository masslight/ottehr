import { DeleteAdHocReportInput, DeleteAdHocReportInputSchema, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): DeleteAdHocReportInput & { secrets: Secrets } {
  const parsed = validateWithSchema(DeleteAdHocReportInputSchema, input);

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = parsed.secrets;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw MISSING_REQUEST_SECRETS;
  }

  return parsed;
}
