import { Secrets } from 'utils/lib/secrets';
import { RunSystemReportInput, RunSystemReportInputSchema } from 'utils/lib/types/adhoc/system/system-report';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

export type ValidatedParams = RunSystemReportInput & { secrets: Secrets };

// Only a report id, the date range and the run parameters: the plan and the code come from the Basic.
export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  return validateWithSchema(RunSystemReportInputSchema, input);
}
