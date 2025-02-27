import { ZambdaInput } from 'zambda-utils';
import { SubmitLabOrder } from '.';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrder {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dx, patientId, encounter, coverage, location, practitionerId, orderableItem, pscHold } = JSON.parse(
    input.body
  );

  const missingResources = [];
  if (!dx) missingResources.push('dx');
  if (!patientId) missingResources.push('patientId');
  if (!encounter) missingResources.push('encounter');
  if (!coverage) missingResources.push('coverage');
  if (!location) missingResources.push('location');
  if (!practitionerId) missingResources.push('practitionerId');
  if (!orderableItem) missingResources.push('orderableItem');
  if (missingResources.length) {
    throw new Error(`missing required resource(s): ${missingResources.join(',')}`);
  }

  return {
    dx,
    patientId,
    encounter,
    coverage,
    location,
    practitionerId,
    orderableItem,
    pscHold,
    secrets: input.secrets,
  };
}
