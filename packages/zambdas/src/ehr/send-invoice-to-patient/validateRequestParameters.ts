import { SendInvoiceToPatientZambdaInput, SendInvoiceToPatientZambdaInputSchema } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): SendInvoiceToPatientZambdaInput & Pick<ZambdaInput, 'secrets'> {
  console.log('validating request parameters');
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { patientId, candidClaimId } = SendInvoiceToPatientZambdaInputSchema.parse(parsedJSON);

  return {
    secrets: input.secrets,
    patientId,
    candidClaimId,
  };
}
