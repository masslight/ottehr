import { GetPatientBalancesInput, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../shared';

export interface ValidatedInput {
  body: GetPatientBalancesInput;
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

const validateBody = (input: ZambdaInput): GetPatientBalancesInput => {
  const { patientId } = validateJsonBody(input);

  if (!patientId) {
    throw new Error('patientId is required');
  }

  if (typeof patientId !== 'string') {
    throw new Error('patientId must be a string');
  }

  return {
    patientId,
  };
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const {
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    CANDID_CLIENT_ID,
    CANDID_CLIENT_SECRET,
    CANDID_ENV,
  } = secrets;
  if (
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API ||
    !CANDID_CLIENT_ID ||
    !CANDID_CLIENT_SECRET ||
    !CANDID_ENV
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    CANDID_CLIENT_ID,
    CANDID_CLIENT_SECRET,
    CANDID_ENV,
  };
};
