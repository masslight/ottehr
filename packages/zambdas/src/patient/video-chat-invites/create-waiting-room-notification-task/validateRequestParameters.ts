import { Secrets, VideoChatNotificationInput } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: VideoChatNotificationInput;
}

const VideoChatNotificationBodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const body = validateBody(input);

  return {
    body,
  };
};

const validateBody = (input: ZambdaInput): VideoChatNotificationInput => {
  const { appointmentId } = safeValidate(VideoChatNotificationBodySchema, input.body ? safeJsonParse(input.body) : {});

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
