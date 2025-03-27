import { SubmitLabOrder } from '.';
import { ZambdaInput } from '../../shared/types';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrder {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dx, encounter, practitionerId, orderableItem, pscHold } = JSON.parse(input.body);

  const missingResources = [];
  if (!dx) missingResources.push('dx');
  if (!encounter) missingResources.push('encounter');
  if (!practitionerId) missingResources.push('practitionerId');
  if (!orderableItem) missingResources.push('orderableItem');
  if (missingResources.length) {
    throw new Error(`missing required resource(s): ${missingResources.join(',')}`);
  }

  return {
    dx,
    encounter,
    practitionerId,
    orderableItem,
    pscHold,
    secrets: input.secrets,
  };
}
