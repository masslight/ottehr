import { ZambdaInput } from 'zambda-utils';
import { CommunicationSubscriptionInput } from '.';
import { Communication } from 'fhir/r4b';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): CommunicationSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const communication = JSON.parse(input.body);

  if (communication.resourceType !== 'Communication') {
    throw new Error(`resource parsed should be a communication but was a ${communication.resourceType}`);
  }

  return {
    communication: communication as Communication,
    secrets: input.secrets,
  };
}
