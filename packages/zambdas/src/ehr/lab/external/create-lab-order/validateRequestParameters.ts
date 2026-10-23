import { CreateLabOrderParameters } from 'utils/lib/types/data/labs/labs.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): CreateLabOrderParameters & { secrets: any } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    dx,
    encounter,
    orderableItems,
    psc,
    orderingLocation,
    selectedPaymentMethod,
    clinicalInfoNoteByUser,
    isStat,
  } = safeJsonParse(input.body);

  const missingResources = [];
  if (!dx) missingResources.push('dx (diagnosis)');
  if (!encounter) missingResources.push('encounter');
  if (!orderableItems || orderableItems.length === 0) missingResources.push('orderableItems (lab test)');
  if (!orderingLocation) missingResources.push('ordering location');
  if (!selectedPaymentMethod) missingResources.push('selectedPaymentMethod');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  if (typeof isStat !== 'boolean') throw INVALID_INPUT_ERROR(`isStat should be type boolean`);

  return {
    dx,
    encounter,
    orderableItems,
    psc,
    orderingLocation,
    selectedPaymentMethod,
    clinicalInfoNoteByUser,
    isStat,
    secrets: input.secrets,
  };
}
