import {
  DeleteRadiologyResultZambdaInput,
  DeleteRadiologyResultZambdaInputSchema,
} from 'utils/lib/types/api/radiology';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { validateJsonBody } from '../../../shared/helpers';

export interface ValidatedInput {
  body: DeleteRadiologyResultZambdaInput;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const body = safeValidate(DeleteRadiologyResultZambdaInputSchema, validateJsonBody(input));
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
