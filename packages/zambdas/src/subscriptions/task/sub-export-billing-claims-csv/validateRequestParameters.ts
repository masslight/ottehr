import { EXPORT_CLAIMS_FILTERS_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { ExportBillingClaimsInput, ExportBillingClaimsInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { TaskSubscriptionInput } from '../validateRequestParameters';

export interface ExportBillingClaimsCsvParams extends ExportBillingClaimsInput {
  taskId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: TaskSubscriptionInput): ExportBillingClaimsCsvParams {
  if (!input.task) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const taskId = input.task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  const filters = input.task.input?.find(
    (taskInput) => taskInput.type?.coding?.some((coding) => coding.code === EXPORT_CLAIMS_FILTERS_CODE)
  )?.valueString;

  const data = safeValidate(ExportBillingClaimsInputSchema, filters ? JSON.parse(filters) : {});

  return {
    ...data,
    taskId,
    secrets: input.secrets,
  };
}
