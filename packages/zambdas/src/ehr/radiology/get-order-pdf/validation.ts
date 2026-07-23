import { GetRadiologyOrderPdfZambdaInput, GetRadiologyOrderPdfZambdaInputSchema, Secrets } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: GetRadiologyOrderPdfZambdaInput;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const body = safeValidate(GetRadiologyOrderPdfZambdaInputSchema, validateJsonBody(input));
  return { body };
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
