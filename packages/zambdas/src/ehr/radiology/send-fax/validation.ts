import { INVALID_INPUT_ERROR, isPhoneNumberValid, Secrets, SendRadiologyOrderFaxZambdaInput } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';

export interface ValidatedInput {
  body: SendRadiologyOrderFaxZambdaInput;
  callerAccessToken: string;
}

export const validateInput = (input: ZambdaInput): ValidatedInput => {
  const { serviceRequestId, faxNumber } = validateJsonBody(input);

  if (!serviceRequestId || typeof serviceRequestId !== 'string') {
    throw new Error('serviceRequestId is required and must be a string');
  }
  if (!faxNumber || typeof faxNumber !== 'string') {
    throw new Error('faxNumber is required and must be a string');
  }
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
