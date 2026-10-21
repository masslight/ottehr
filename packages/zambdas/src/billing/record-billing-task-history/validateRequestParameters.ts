import { RecordBillingTaskHistoryInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { isM2MClient } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export type RecordBillingTaskHistoryParams = ValidatedZambdaInput<typeof RecordBillingTaskHistoryInputSchema>;

// machine clients only
export function validateRequestParameters(input: ZambdaInput): RecordBillingTaskHistoryParams {
  const token = input.headers?.Authorization?.replace('Bearer ', '');
  if (!token || !isM2MClient(token)) throw NOT_AUTHORIZED;

  return validateWithSchema(RecordBillingTaskHistoryInputSchema, input);
}
