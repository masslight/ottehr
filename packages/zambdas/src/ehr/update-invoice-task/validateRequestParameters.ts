import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateInvoiceTaskZambdaInput,
  UpdateInvoiceTaskZambdaInputSchema,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInvoiceTaskZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (input.secrets == null) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = safeJsonParse(input.body);
  const { taskId, status, invoiceTaskInput } = safeValidate(UpdateInvoiceTaskZambdaInputSchema, parsedJSON);

  return {
    taskId,
    status,
    invoiceTaskInput,
    secrets: input.secrets,
  };
}
