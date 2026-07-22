import { Secrets, UploadRadiologyResultZambdaInput, UploadRadiologyResultZambdaInputSchema } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: UploadRadiologyResultZambdaInput;
  callerAccessToken: string;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const body = safeValidate(UploadRadiologyResultZambdaInputSchema, validateJsonBody(input));

  const callerAccessToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!callerAccessToken) {
    throw new Error('Authorization header is required');
  }

  return { body, callerAccessToken };
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
