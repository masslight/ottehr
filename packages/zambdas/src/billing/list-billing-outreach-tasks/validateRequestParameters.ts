import { ListBillingOutreachTasksInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): ValidatedZambdaInput<typeof ListBillingOutreachTasksInputSchema> {
  const params = validateWithSchema(ListBillingOutreachTasksInputSchema, input);
  if (!isOutreachInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }
  return params;
}
