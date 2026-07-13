import { GetRadiologyOrderPdfZambdaInput, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: GetRadiologyOrderPdfZambdaInput;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const { serviceRequestId } = validateJsonBody(input);

  if (!serviceRequestId || typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId is required and must be a string');
  }

  return { body: { serviceRequestId } };
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
