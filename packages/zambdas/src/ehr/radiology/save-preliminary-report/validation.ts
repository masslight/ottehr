import { SavePreliminaryReportZambdaInput, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: SavePreliminaryReportZambdaInput;
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

const validateBody = (input: ZambdaInput): SavePreliminaryReportZambdaInput => {
  const { serviceRequestId, preliminaryReport } = validateJsonBody(input);

  if (!serviceRequestId) {
    throw new Error('serviceRequestId is required');
  }

  if (!preliminaryReport) {
    throw new Error('preliminaryReport is required');
  }

  if (typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId must be a string');
  }

  if (typeof preliminaryReport !== 'string') {
    throw new Error('preliminaryReport must be a string');
  }

  return {
    serviceRequestId,
    preliminaryReport,
  };
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
  } = secrets;
  if (
    !ADVAPACS_CLIENT_ID ||
    !ADVAPACS_CLIENT_SECRET ||
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
  };
};
