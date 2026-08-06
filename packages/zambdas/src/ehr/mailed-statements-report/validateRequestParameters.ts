import { Secrets } from 'utils/lib/secrets';
import { MailedStatementsReportZambdaInput } from 'utils/lib/types/api/mailed-statements-report.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const dateRangeSchema = z.object({
  dateRange: z.object({
    start: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'start must be a valid ISO date string' }),
    end: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'end must be a valid ISO date string' }),
  }),
});

export function validateRequestParameters(
  input: ZambdaInput
): MailedStatementsReportZambdaInput & { secrets: Secrets } {
  if (!input.body) throw MISSING_REQUEST_BODY;

  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedBody = safeJsonParse(input.body) as unknown;
  const { dateRange } = safeValidate(dateRangeSchema, parsedBody);

  return {
    dateRange,
    secrets: input.secrets,
  };
}
