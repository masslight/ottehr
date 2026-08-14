import { Secrets } from 'utils/lib/secrets';
import { GetRadiologyOrderPdfZambdaInput, GetRadiologyOrderPdfZambdaInputSchema } from 'utils/lib/types/api/radiology';
import { validateJsonBody } from '../../../shared/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

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
