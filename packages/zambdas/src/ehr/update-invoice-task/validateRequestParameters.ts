import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PrefilledInvoiceInfo,
  UpdateInvoiceTaskZambdaInputSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): { taskId: string; status: string; prefilledInfo: PrefilledInvoiceInfo } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (input.secrets == null) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = JSON.parse(input.body);
  const { taskId, status, prefilledInvoiceInfo } = UpdateInvoiceTaskZambdaInputSchema.parse(parsedJSON);

  return {
    taskId,
    status,
    prefilledInfo: prefilledInvoiceInfo,
    secrets: input.secrets,
  };
}
