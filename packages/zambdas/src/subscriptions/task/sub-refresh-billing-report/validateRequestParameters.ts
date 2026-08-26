import { REFRESH_REPORT_KINDS, RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { refreshTaskKind, refreshTaskParamsJson } from '../../../billing/reports/framework/refresh-task';
import { ZambdaInput } from '../../../shared/types/common';
import { TaskSubscriptionInput } from '../validateRequestParameters';

export interface RefreshBillingReportParams {
  kind: RefreshReportKind;
  // JSON-serialized report params from the Task input
  paramsJson: string;
  taskId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: TaskSubscriptionInput): RefreshBillingReportParams {
  if (!input.task) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const taskId = input.task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  const kind = refreshTaskKind(input.task);
  if (!kind || !REFRESH_REPORT_KINDS.includes(kind as RefreshReportKind)) {
    throw new Error(`Unknown report kind '${kind ?? ''}' on Task/${taskId}`);
  }

  return {
    kind: kind as RefreshReportKind,
    paramsJson: refreshTaskParamsJson(input.task) ?? '{}',
    taskId,
    secrets: input.secrets,
  };
}
