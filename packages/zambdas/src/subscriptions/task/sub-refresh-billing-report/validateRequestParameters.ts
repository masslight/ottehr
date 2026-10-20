import { REFRESH_REPORT_KINDS } from 'utils/lib/types/data/billing/billing.constants';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { refreshTaskKind, refreshTaskParamsJson } from '../../../billing/reports/framework/refresh-task';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { TaskSubscriptionInput } from '../validateRequestParameters';

const RefreshTaskInputSchema = z.object({
  kind: z.enum(REFRESH_REPORT_KINDS),
  // JSON-serialized report params from the Task input
  paramsJson: z.string(),
  taskId: z.string().min(1),
});

export interface RefreshBillingReportParams extends z.infer<typeof RefreshTaskInputSchema> {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: TaskSubscriptionInput): RefreshBillingReportParams {
  if (!input.task) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const validated = safeValidate(RefreshTaskInputSchema, {
    kind: refreshTaskKind(input.task),
    paramsJson: refreshTaskParamsJson(input.task) ?? '{}',
    taskId: input.task.id,
  });

  return { ...validated, secrets: input.secrets };
}
