import { CreateInHouseMedicationInput } from 'utils/lib/types/api/config/in-house-medications';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
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

  const { name, ndc, medispanID, medispanIDForInteractions, vaccine } = safeJsonParse(input.body);

  // A vaccine is named by its CVX code alone; a medication by its Medispan drug.
  if (vaccine !== undefined) {
    if (typeof vaccine?.cvx !== 'string' || !getCvxVaccine(vaccine.cvx)) {
      throw INVALID_INPUT_ERROR('vaccine.cvx must be a CVX code from the vaccine list');
    }
    console.groupEnd();
    return { vaccine: { cvx: vaccine.cvx }, secrets: input.secrets };
  }

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
