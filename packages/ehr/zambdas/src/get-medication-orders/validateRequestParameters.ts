import { GetMedicationOrdersInput } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId } = JSON.parse(input.body);

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    encounterId,
    secrets: input.secrets,
  };
}
