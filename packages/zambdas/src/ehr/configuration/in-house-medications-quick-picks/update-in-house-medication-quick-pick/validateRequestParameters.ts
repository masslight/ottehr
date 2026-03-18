import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, UpdateInHouseMedicationQuickPickInput } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInHouseMedicationQuickPickInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { quickPickID, status, name } = JSON.parse(input.body);

  if (!quickPickID) {
    throw MISSING_REQUIRED_PARAMETERS(['quickPickID']);
  }

  if (status) {
    if (!['active', 'inactive'].includes(status)) {
      throw INVALID_INPUT_ERROR('Status must be either active or inactive');
    }
  } else {
    if (!name) {
      throw MISSING_REQUIRED_PARAMETERS(['name']);
    }
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    quickPickID,
    name,
    status,
    secrets: input.secrets,
  };
}
