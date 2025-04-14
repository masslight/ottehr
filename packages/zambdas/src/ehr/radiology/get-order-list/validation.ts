import { GetRadiologyOrderListZambdaInput, isValidUUID, Secrets } from 'utils';
import { DEFAULT_RADS_ITEMS_PER_PAGE, ValidatedInput } from '.';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export const validateInput = async (input: ZambdaInput): Promise<ValidatedInput> => {
  const validatedBody = await validateBody(input);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = async (input: ZambdaInput): Promise<GetRadiologyOrderListZambdaInput> => {
  const { encounterId, patientId, itemsPerPage = DEFAULT_RADS_ITEMS_PER_PAGE, pageIndex = 0 } = validateJsonBody(input);

  if (patientId && encounterId) {
    throw new Error('Only one of patientId or encounterId may be sent at a time');
  }

  if (!patientId && !encounterId) {
    throw new Error('Either patientId or encounterId is required');
  }

  if (encounterId && !isValidUUID(encounterId)) {
    throw new Error('encounterId must be a uuid');
  }

  if (patientId && !isValidUUID(patientId)) {
    throw new Error('patientId must be a uuid');
  }

  if (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1) {
    throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
  }

  if (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0) {
    throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
  }

  return {
    encounterId,
    patientId,
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
