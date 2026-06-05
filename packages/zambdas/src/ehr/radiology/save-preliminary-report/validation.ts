import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, SaveRadiologyReportZambdaInput, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: SaveRadiologyReportZambdaInput;
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

const validateBody = (input: ZambdaInput): SaveRadiologyReportZambdaInput => {
  const { serviceRequestId, report } = validateJsonBody(input);

  if (!serviceRequestId) {
    throw MISSING_REQUIRED_PARAMETERS(['serviceRequestId']);
  }

  if (!report) {
    throw MISSING_REQUIRED_PARAMETERS(['report']);
  }

  if (typeof serviceRequestId !== 'string') {
    throw INVALID_INPUT_ERROR('serviceRequestId must be a string');
  }

  if (typeof report !== 'string') {
    throw INVALID_INPUT_ERROR('report must be a string');
  }

  return {
    serviceRequestId,
    report,
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
