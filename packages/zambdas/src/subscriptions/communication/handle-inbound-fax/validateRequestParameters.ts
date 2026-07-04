import { Communication } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface HandleInboundFaxInput {
  communication: Communication;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): HandleInboundFaxInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const communication = JSON.parse(input.body) as Communication;

  if (communication.resourceType !== 'Communication') {
    throw INVALID_INPUT_ERROR(`Expected Communication but got ${communication.resourceType}`);
  }

  if (communication.status !== 'completed') {
    throw INVALID_INPUT_ERROR(`Expected completed status but got ${communication.status}`);
  }

  if (!communication.id) {
    throw INVALID_INPUT_ERROR('Communication is missing id');
  }

  return { communication, secrets: input.secrets };
}
