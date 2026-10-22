import { Secrets } from 'utils/lib/secrets';
import { GetSystemReportInput, GetSystemReportInputSchema } from 'utils/lib/types/adhoc/system/system-report';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

export type ValidatedParams = GetSystemReportInput & { secrets: Secrets };

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  return validateWithSchema(GetSystemReportInputSchema, input);
}
