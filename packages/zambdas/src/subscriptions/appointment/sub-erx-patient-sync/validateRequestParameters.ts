import { Observation } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface ErxPatientSyncSubscriptionInput {
  observation: Observation & { id: string };
  encounterId: string;
  patientId: string;
  secrets: Secrets;
}

export function validateRequestParameters(input: ZambdaInput): ErxPatientSyncSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const observation = JSON.parse(input.body) as Observation;

  if (observation.resourceType !== 'Observation') {
    throw new Error(`resource parsed should be an Observation but was a ${observation.resourceType}`);
  }

  if (!observation.id) {
    throw new Error("Observation FHIR resource doesn't have an id.");
  }

  const encounterId = observation.encounter?.reference?.split('/')[1];
  if (!encounterId) {
    throw new Error(`Encounter reference not found on observation ${observation.id}`);
  }

  const patientId = observation.subject?.reference?.split('/')[1];
  if (!patientId) {
    throw new Error(`Patient reference not found on observation ${observation.id}`);
  }

  if (!input.secrets) {
    throw new Error('Secrets not sent with input.');
  }

  return {
    observation: observation as Observation & { id: string },
    encounterId,
    patientId,
    secrets: input.secrets,
  };
}
