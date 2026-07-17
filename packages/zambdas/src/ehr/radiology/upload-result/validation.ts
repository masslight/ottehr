import { Secrets, UploadRadiologyResultZambdaInput } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: UploadRadiologyResultZambdaInput;
  callerAccessToken: string;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const { serviceRequestId, z3URL, title } = validateJsonBody(input);

  if (!serviceRequestId || typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId is required and must be a string');
  }
  if (!z3URL || typeof z3URL !== 'string') {
    throw new Error('z3URL is required and must be a string');
  }
  if (title != null && typeof title !== 'string') {
    throw new Error('title must be a string');
  }

  const callerAccessToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!callerAccessToken) {
    throw new Error('Authorization header is required');
  }

  return { body: { serviceRequestId, z3URL, title }, callerAccessToken };
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API } = secrets;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE || !FHIR_API || !PROJECT_API) {
    throw new Error('Missing required secrets');
  }
  return secrets;
};
