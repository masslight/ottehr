import { CreateInHouseMedicationInput } from 'utils/lib/types/api/config/in-house-medications';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): CreateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { name, ndc, medispanID, medispanIDForInteractions } = safeJsonParse(input.body);

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
    medispanIDForInteractions,
    secrets: input.secrets,
  };
}
