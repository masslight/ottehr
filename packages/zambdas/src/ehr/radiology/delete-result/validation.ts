import { DeleteRadiologyResultZambdaInput, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: DeleteRadiologyResultZambdaInput;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const { documentReferenceId } = validateJsonBody(input);

  if (!documentReferenceId || typeof documentReferenceId !== 'string') {
    throw new Error('documentReferenceId is required and must be a string');
  }

  return { body: { documentReferenceId } };
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
