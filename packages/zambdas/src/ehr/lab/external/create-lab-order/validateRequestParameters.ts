import { CreateLabOrderParameters } from 'utils/lib/types/data/labs/labs.types';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { safeJsonParse } from '../../../../shared/validation';
import { ZambdaInput } from '../../../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): CreateLabOrderParameters & { secrets: any } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { dx, encounter, orderableItems, psc, orderingLocation, selectedPaymentMethod, clinicalInfoNoteByUser } =
    safeJsonParse(input.body);

  const missingResources = [];
  if (!dx) missingResources.push('dx (diagnosis)');
  if (!encounter) missingResources.push('encounter');
  if (!orderableItems || orderableItems.length === 0) missingResources.push('orderableItems (lab test)');
  if (!orderingLocation) missingResources.push('ordering location');
  if (!selectedPaymentMethod) missingResources.push('selectedPaymentMethod');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    dx,
    encounter,
    orderableItems,
    psc,
    orderingLocation,
    selectedPaymentMethod,
    clinicalInfoNoteByUser,
    secrets: input.secrets,
  };
}
