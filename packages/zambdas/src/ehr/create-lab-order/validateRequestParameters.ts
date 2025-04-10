import { ZambdaInput } from '../../shared/types';
import { CreateLabOrderParameters } from 'utils';

export function validateRequestParameters(input: ZambdaInput): CreateLabOrderParameters & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dx, encounter, orderableItem, psc } = JSON.parse(input.body);

  const missingResources = [];
  if (!dx) missingResources.push('dx');
  if (!encounter) missingResources.push('encounter');
  if (!orderableItem) missingResources.push('orderableItem');
  if (missingResources.length) {
    throw new Error(`missing required resource(s): ${missingResources.join(',')}`);
  }

  return {
    dx,
    encounter,
    orderableItem,
    psc,
    secrets: input.secrets,
  };
}
