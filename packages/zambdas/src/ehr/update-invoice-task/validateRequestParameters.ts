import { PrefilledInvoiceInfo, UpdateInvoiceTaskZambdaInputSchema } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): { taskId: string; status: string; prefilledInfo: PrefilledInvoiceInfo } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { taskId, status, prefilledInvoiceInfo } = UpdateInvoiceTaskZambdaInputSchema.parse(parsedJSON);

  return {
    taskId,
    status,
    prefilledInfo: prefilledInvoiceInfo,
    secrets: input.secrets,
  };
}
