import { ListRadiologyResultsZambdaInput, ListRadiologyResultsZambdaInputSchema, Secrets } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: ListRadiologyResultsZambdaInput;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const body = safeValidate(ListRadiologyResultsZambdaInputSchema, validateJsonBody(input));
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
