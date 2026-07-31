import { DocumentReference } from 'fhir/r4b';
import { ZambdaInput } from '../../../shared/types';
import { ProcessTelemedRecordingSubscriptionInput } from '.';

export function validateRequestParameters(input: ZambdaInput): ProcessTelemedRecordingSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const documentReference = JSON.parse(input.body);

  if (documentReference.resourceType !== 'DocumentReference') {
    throw new Error(`resource parsed should be a DocumentReference but was a ${documentReference.resourceType}`);
  }

  if (!documentReference.id) {
    throw new Error(`Triggering DocumentReference did not have an id. ${JSON.stringify(documentReference)}`);
  }

  return {
    documentReference: documentReference as DocumentReference,
    secrets: input.secrets,
  };
}
