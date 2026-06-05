import { SaveRadiologyReportZambdaInput, Secrets } from 'utils';
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
    throw new Error('serviceRequestId is required');
  }

  if (!report) {
    throw new Error('report is required');
  }

  if (typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId must be a string');
  }

  if (typeof report !== 'string') {
    throw new Error('report must be a string');
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
