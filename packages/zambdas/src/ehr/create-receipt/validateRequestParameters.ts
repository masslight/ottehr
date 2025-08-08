import { CreateReceiptZambdaInput, CreateReceiptZambdaInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateReceiptZambdaInput & {
  secrets: Secrets;
} {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const { encounterId, patientId } = CreateReceiptZambdaInputSchema.parse(parsedJSON);
  console.log('parsed encounterId: ', JSON.stringify(encounterId));

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    encounterId,
    patientId,
    secrets: input.secrets,
  };
}
