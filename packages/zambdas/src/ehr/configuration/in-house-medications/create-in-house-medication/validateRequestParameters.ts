import { CreateInHouseMedicationInput } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CreateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { name, ndc, medispanID } = JSON.parse(input.body);

  if (!name) {
    throw new Error('Medication name is required');
  }

  if (!ndc) {
    throw new Error('NDC is required');
  }

  if (!medispanID) {
    throw new Error('Medispan ID is required');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    name,
    ndc,
    medispanID,
    secrets: input.secrets,
  };
}
