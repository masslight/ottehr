import { GetPrefilledInvoiceInfoZambdaInput, GetPrefilledInvoiceInfoZambdaInputSchema } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetPrefilledInvoiceInfoZambdaInput & Pick<ZambdaInput, 'secrets'> {
  console.log('validating request parameters');
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { patientId } = GetPrefilledInvoiceInfoZambdaInputSchema.parse(parsedJSON);

  return {
    secrets: input.secrets,
    patientId,
  };
}
