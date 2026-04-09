import { CreateInHouseMedicationInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CreateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { name, ndc, medispanID, cptCodes, hcpcsCodes } = JSON.parse(input.body);

  if (!name) {
    throw MISSING_REQUIRED_PARAMETERS(['name']);
  }

  if (!medispanID) {
    throw MISSING_REQUIRED_PARAMETERS(['medispanID']);
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    name,
    ndc,
    medispanID,
    cptCodes,
    hcpcsCodes,
    secrets: input.secrets,
  };
}
