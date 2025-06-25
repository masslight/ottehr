import { GetMedicationOrdersInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId } = JSON.parse(input.body);

  if (typeof encounterId !== 'string') {
    throw new Error('Encounter ID is not a string');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    encounterId,
    secrets: input.secrets,
  };
}
