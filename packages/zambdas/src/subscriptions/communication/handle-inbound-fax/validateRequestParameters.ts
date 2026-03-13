import { Communication } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface HandleInboundFaxInput {
  communication: Communication;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): HandleInboundFaxInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const communication = JSON.parse(input.body) as Communication;

  if (communication.resourceType !== 'Communication') {
    throw new Error(`Expected Communication but got ${communication.resourceType}`);
  }

  if (communication.status !== 'completed') {
    throw new Error(`Expected completed status but got ${communication.status}`);
  }

  if (!communication.id) {
    throw new Error('Communication is missing id');
  }

  return { communication, secrets: input.secrets };
}
