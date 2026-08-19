import { Secrets } from 'utils/lib/secrets';
import {
  GetAdHocReportStatusInput,
  GetAdHocReportStatusInputSchema,
  StartAdHocReportInput,
  StartAdHocReportInputSchema,
} from 'utils/lib/types/adhoc/generation/report-task';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export type ValidatedParams =
  | (StartAdHocReportInput & { secrets: Secrets })
  | (GetAdHocReportStatusInput & { secrets: Secrets });

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = safeJsonParse(input.body) as Record<string, unknown>;

  if ('taskId' in parsedJSON && parsedJSON.taskId) {
    const parsed = safeValidate(GetAdHocReportStatusInputSchema, parsedJSON);
    return { ...parsed, secrets: input.secrets };
  }

  const parsed = safeValidate(StartAdHocReportInputSchema, parsedJSON);
  return { ...parsed, secrets: input.secrets };
}
