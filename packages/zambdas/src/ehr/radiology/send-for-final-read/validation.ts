import { Secrets } from 'utils/lib/secrets';
import { SendForFinalReadZambdaInput, SendForFinalReadZambdaInputSchema } from 'utils/lib/types/api/radiology';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface ValidatedInput {
  body: SendForFinalReadZambdaInput;
  callerAccessToken: string;
}

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const body = safeValidate(SendForFinalReadZambdaInputSchema, validateJsonBody(input));

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body,
    callerAccessToken,
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
