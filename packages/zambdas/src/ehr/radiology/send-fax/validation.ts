import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import {
  SendRadiologyOrderFaxZambdaInput,
  SendRadiologyOrderFaxZambdaInputSchema,
} from 'utils/lib/types/api/radiology';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { validateJsonBody } from '../../../shared/helpers';

export interface ValidatedInput {
  body: SendRadiologyOrderFaxZambdaInput;
  callerAccessToken: string;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const { serviceRequestId, faxNumber } = safeValidate(SendRadiologyOrderFaxZambdaInputSchema, validateJsonBody(input));

  if (!isPhoneNumberValid(faxNumber)) {
    throw INVALID_INPUT_ERROR('"faxNumber" is not a valid phone number');
  }

  // Normalize to E.164 (+1XXXXXXXXXX) from whatever formatting the client sent.
  const tenDigits = faxNumber.replace(/\D/g, '').slice(-10);

  const callerAccessToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!callerAccessToken) {
    throw new Error('Authorization header is required');
  }

  return { body: { serviceRequestId, faxNumber: `+1${tenDigits}` }, callerAccessToken };
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
