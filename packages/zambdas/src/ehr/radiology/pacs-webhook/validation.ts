import { Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { ValidatedInput } from '.';

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  return await validateBody(input);
};

const validateBody = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const maybeFHIRResource = validateJsonBody(input);

  const { resourceType } = maybeFHIRResource;

  if (resourceType === 'ServiceRequest') {
    // TODO expand to cover ensuring that expected fields are present and have expected values of ServiceRequest
    return {
      resource: maybeFHIRResource,
    };
  } else if (resourceType === 'DiagnosticReport') {
    // TODO expand to cover ensuring that expected fields are present and have expected values of DiagnosticReport
    return {
      resource: maybeFHIRResource,
    };
  } else if (resourceType === 'ImagingStudy') {
    // TODO expand to cover ensuring that expected fields are present and have expected values of ImagingStudy
    return {
      resource: maybeFHIRResource,
    };
  }

  throw new Error('Invalid webhook input');
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
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    ADVAPACS_WEBHOOK_SECRET,
  } = secrets;
  if (
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API ||
    !ADVAPACS_CLIENT_ID ||
    !ADVAPACS_CLIENT_SECRET ||
    !ADVAPACS_WEBHOOK_SECRET
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
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    ADVAPACS_WEBHOOK_SECRET,
  };
};
