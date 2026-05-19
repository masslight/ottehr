import { Secrets, UpdateRadiologyOrderConsentZambdaInput } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: UpdateRadiologyOrderConsentZambdaInput;
  callerAccessToken: string;
}

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const body = validateBody(input);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body,
    callerAccessToken,
  };
};

const validateBody = (input: ZambdaInput): UpdateRadiologyOrderConsentZambdaInput => {
  const { serviceRequestId, consentObtained } = validateJsonBody(input);

  if (!serviceRequestId) {
    throw new Error('serviceRequestId is required');
  }

  if (typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId must be a string');
  }

  if (typeof consentObtained !== 'boolean') {
    throw new Error('consentObtained must be a boolean');
  }

  return {
    serviceRequestId,
    consentObtained,
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
