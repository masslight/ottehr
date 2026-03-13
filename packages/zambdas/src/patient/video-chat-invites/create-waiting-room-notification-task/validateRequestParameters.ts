import { isValidUUID, Secrets, VideoChatNotificationInput } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: VideoChatNotificationInput;
}

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const body = validateBody(input);

  return {
    body,
  };
};

const validateBody = (input: ZambdaInput): VideoChatNotificationInput => {
  const { appointmentId } = validateJsonBody(input);

  if (!appointmentId) {
    throw new Error('appointmentId is required');
  }

  if (typeof appointmentId !== 'string') {
    throw new Error('appointmentId must be a string');
  }

  if (isValidUUID(appointmentId) === false) {
    throw new Error('appointmentId must be a valid UUID');
  }

  return {
    appointmentId,
  };
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API } = secrets;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE || !FHIR_API || !PROJECT_API) {
    throw new Error('Missing required secrets');
  }
  return {
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
  };
};
