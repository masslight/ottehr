import {
  REFRESH_REPORT_KIND_CODE,
  REFRESH_REPORT_KINDS,
  RefreshReportKind,
} from 'utils/lib/types/data/billing/billing.constants';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { TaskSubscriptionInput } from '../validateRequestParameters';

export interface RefreshBillingReportParams {
  kind: RefreshReportKind;
  taskId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: TaskSubscriptionInput): RefreshBillingReportParams {
  if (!input.task) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const taskId = input.task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  const kind = input.task.input?.find(
    (taskInput) => taskInput.type?.coding?.some((coding) => coding.code === REFRESH_REPORT_KIND_CODE)
  )?.valueString;
  if (!kind || !REFRESH_REPORT_KINDS.includes(kind as RefreshReportKind)) {
    throw new Error(`Unknown report kind '${kind ?? ''}' on Task/${taskId}`);
  }

  return {
    kind: kind as RefreshReportKind,
    taskId,
    secrets: input.secrets,
  };
}
