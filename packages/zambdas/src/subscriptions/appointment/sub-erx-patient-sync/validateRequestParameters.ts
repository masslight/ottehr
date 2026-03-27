import { Encounter } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface ErxPatientSyncSubscriptionInput {
  encounter: Encounter;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): ErxPatientSyncSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const encounter = JSON.parse(input.body) as Encounter;

  if (encounter.resourceType !== 'Encounter') {
    throw new Error(`resource parsed should be an Encounter but was a ${encounter.resourceType}`);
  }

  if (!input.secrets) {
    throw new Error('Secrets not sent with input.');
  }

  return {
    encounter,
    secrets: input.secrets,
  };
}
