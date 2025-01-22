import { ZambdaInput } from '../types';
import { GetMedicationOrdersInput } from 'utils';

export function validateRequestParameters(input: ZambdaInput): GetMedicationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  // if (getSecret(SecretsKeys.PROJECT_API, input.secrets) === undefined) {
  //   throw new Error('"PROJECT_API" configuration not provided');
  // }

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
