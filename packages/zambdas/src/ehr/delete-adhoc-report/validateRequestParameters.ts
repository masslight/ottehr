import { DeleteAdHocReportInput, DeleteAdHocReportInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): DeleteAdHocReportInput & { secrets: Secrets } {
  return validateWithSchema(DeleteAdHocReportInputSchema, input);
}
