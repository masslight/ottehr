import { Encounter } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface ErxPatientSyncSubscriptionInput {
  encounter: Encounter & { id: string };
  patientId: string;
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

  if (!encounter.id) {
    throw new Error("Encounter FHIR resource doesn't have an id.");
  }

  const patientId = encounter.subject?.reference?.split('/')[1];
  if (!patientId) {
    throw new Error(`Patient reference not found on encounter ${encounter.id}`);
  }

  if (!input.secrets) {
    throw new Error('Secrets not sent with input.');
  }

  return {
    encounter: encounter as Encounter & { id: string },
    patientId,
    secrets: input.secrets,
  };
}
