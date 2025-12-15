import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateInvoiceTaskZambdaInput,
  UpdateInvoiceTaskZambdaInputSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInvoiceTaskZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (input.secrets == null) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = JSON.parse(input.body);
  const { taskId, status, prefilledInvoiceInfo, userTimezone } = UpdateInvoiceTaskZambdaInputSchema.parse(parsedJSON);

  return {
    taskId,
    status,
    prefilledInvoiceInfo,
    secrets: input.secrets,
    userTimezone,
  };
}
