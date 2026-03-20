import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, UpdateInHouseMedicationInput } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { medicationID, status, name, ndc, medispanID } = JSON.parse(input.body);

  if (!medicationID) {
    throw MISSING_REQUIRED_PARAMETERS(['medicationID']);
  }

  if (status) {
    if (!['active', 'inactive'].includes(status)) {
      throw INVALID_INPUT_ERROR('Status must be either active or inactive');
    }
  } else {
    if (!name) {
      throw MISSING_REQUIRED_PARAMETERS(['name']);
    }

    if (!ndc) {
      throw MISSING_REQUIRED_PARAMETERS(['ndc']);
    }

    if (!medispanID) {
      throw MISSING_REQUIRED_PARAMETERS(['medispanID']);
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
