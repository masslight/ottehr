import { GetRadiologyOrderListZambdaInputSchema, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';
import { ValidatedInput } from '.';

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const validatedBody = validateBody(input);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw MISSING_REQUIRED_PARAMETERS(['callerAccessToken']);
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = (input: ZambdaInput): ValidatedInput['body'] => {
  const { encounterIds, patientId, serviceRequestId, itemsPerPage, pageIndex } = safeValidate(
    GetRadiologyOrderListZambdaInputSchema,
    validateJsonBody(input)
  );

  // Normalize a single encounterId to an array.
  const encounterIdsArr =
    encounterIds == null ? undefined : Array.isArray(encounterIds) ? [...encounterIds] : [encounterIds];

  return {
    encounterIds: encounterIdsArr,
    patientId,
    serviceRequestId,
    itemsPerPage,
    pageIndex,
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
