import { INVALID_INPUT_ERROR, isValidUUID, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { ValidatedInput } from '.';

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const validatedBody = await validateBody(input);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw MISSING_REQUIRED_PARAMETERS(['callerAccessToken']);
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = async (input: ZambdaInput): Promise<ValidatedInput['body']> => {
  const { encounterIds, patientId, serviceRequestId, itemsPerPage, pageIndex } = validateJsonBody(input);

  if (
    (patientId && (serviceRequestId || encounterIds)) ||
    (encounterIds && (patientId || serviceRequestId)) ||
    (serviceRequestId && (patientId || encounterIds))
  ) {
    throw INVALID_INPUT_ERROR('Only one of patientId, encounterIds, serviceRequestId may be sent at a time');
  }

  if (!patientId && !encounterIds && !serviceRequestId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId or encounterIds or serviceRequestId']);
  }

  if (encounterIds && !Array.isArray(encounterIds) && !isValidUUID(encounterIds)) {
    throw INVALID_INPUT_ERROR('"encounterIds" must be a valid uuid');
  }

  if (encounterIds && Array.isArray(encounterIds) && encounterIds.some((id: any) => !isValidUUID(id))) {
    throw INVALID_INPUT_ERROR('all strings within "encounterIds" must be valid uuids');
  }

  if (patientId && !isValidUUID(patientId)) {
    throw INVALID_INPUT_ERROR('"patientId" must be a uuid');
  }

  if (serviceRequestId && !isValidUUID(serviceRequestId)) {
    throw INVALID_INPUT_ERROR('"serviceRequestId" must be a uuid');
  }

  if (itemsPerPage && (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1)) {
    throw INVALID_INPUT_ERROR('If "itemsPerPage" is included then it must be a number greater than 0');
  }

  if (pageIndex && (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0)) {
    throw INVALID_INPUT_ERROR('If "pageIndex" is included then it must be a number greater than or equal to 0');
  }

  let encounterIdsArr: string[] | undefined;
  if (encounterIds) {
    encounterIdsArr = Array.isArray(encounterIds) ? [...encounterIds] : [encounterIds];
  }

  if (encounterIdsArr) {
    // Ensure there is at least one item in the array
    if (encounterIdsArr.length === 0) {
      throw INVALID_INPUT_ERROR('if "encounterIds" is specified then it must have at least one valid uuid');
    }
  }

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
