import {
  MISSING_REQUIRED_PARAMETERS,
  SaveRadiologyReportZambdaInput,
  SaveRadiologyReportZambdaInputSchema,
  Secrets,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: SaveRadiologyReportZambdaInput;
  callerAccessToken: string;
}

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const body = safeValidate(SaveRadiologyReportZambdaInputSchema, validateJsonBody(input));

  // Diagnosis is optional at order time but required when saving a preliminary read. The shared input
  // schema keeps diagnosisCodes optional (the final-report flow ignores it), so enforce it here.
  if (body.diagnosisCodes == null || body.diagnosisCodes.length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['diagnosisCodes']);
  }

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
