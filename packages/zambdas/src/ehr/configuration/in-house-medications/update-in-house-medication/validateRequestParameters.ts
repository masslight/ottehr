import {
  InHouseMedicationInventorySchema,
  UpdateInHouseMedicationInput,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateInHouseMedicationInput & Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { medicationID, status, name, ndc, medispanID, medispanIDForInteractions, inventory } = safeJsonParse(
    input.body
  );

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
  }

  // undefined leaves the inventory setup alone and null clears it; anything else must be a full setup
  const validatedInventory =
    inventory === undefined || inventory === null
      ? inventory
      : safeValidate(InHouseMedicationInventorySchema, inventory);

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    medicationID,
    status,
    name,
    ndc,
    medispanID,
    medispanIDForInteractions,
    inventory: validatedInventory,
    secrets: input.secrets,
  };
}
