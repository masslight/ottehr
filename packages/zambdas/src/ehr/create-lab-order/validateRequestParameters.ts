import { CreateLabOrderParameters, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared/types';

export function validateRequestParameters(input: ZambdaInput): CreateLabOrderParameters & { secrets: any } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { dx, encounter, orderableItem, psc } = JSON.parse(input.body);

  const missingResources = [];
  if (!dx) missingResources.push('dx (diagnosis)');
  if (!encounter) missingResources.push('encounter');
  if (!orderableItem) missingResources.push('orderableItem (lab test)');
  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    dx,
    encounter,
    orderableItem,
    psc,
    secrets: input.secrets,
  };
}
