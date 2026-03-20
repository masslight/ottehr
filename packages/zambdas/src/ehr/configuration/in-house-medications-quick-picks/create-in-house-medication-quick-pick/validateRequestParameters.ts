import { CreateInHouseMedicationQuickPickInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CreateInHouseMedicationQuickPickInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { name, medicationID, dose, units, route, instructions } = JSON.parse(input.body);

  if (!name) {
    throw MISSING_REQUIRED_PARAMETERS(['name']);
  }

  if (!medicationID) {
    throw MISSING_REQUIRED_PARAMETERS(['medicationID']);
  }

  if (dose == undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['dose']);
  }

  const doseNumber = parseFloat(dose);

  if (!units) {
    throw MISSING_REQUIRED_PARAMETERS(['units']);
  }

  if (!route) {
    throw MISSING_REQUIRED_PARAMETERS(['route']);
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    name,
    medicationID,
    dose: doseNumber,
    units,
    route,
    instructions,
    secrets: input.secrets,
  };
}
