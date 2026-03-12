import { UpdateInHouseMedicationInput } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { medicationID, status, name, ndc, medispanID } = JSON.parse(input.body);

  if (!medicationID) {
    throw new Error('Medication ID is required');
  }

  if (status) {
    if (!['active', 'inactive'].includes(status)) {
      throw new Error('Status must be either active or inactive');
    }
  } else {
    if (!name) {
      throw new Error('Medication name is required');
    }

    if (!ndc) {
      throw new Error('NDC is required');
    }

    if (!medispanID) {
      throw new Error('Medispan ID is required');
    }
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    medicationID,
    status,
    name,
    ndc,
    medispanID,
    secrets: input.secrets,
  };
}
