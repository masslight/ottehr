import {
  INVALID_INPUT_ERROR,
  isPhoneNumberValid,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SendFaxZambdaInput,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = JSON.parse(input.body) as SendFaxZambdaInput;

  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }
  const { appointmentId, faxNumber } = data;

  const missingParams: string[] = [];
  if (!appointmentId) {
    missingParams.push('appointmentId');
  }
  if (!faxNumber) {
    missingParams.push('faxNumber');
  }
  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }
  if (!isPhoneNumberValid(faxNumber)) {
    throw INVALID_INPUT_ERROR('"faxNumber" is not a valid phone number');
  }

  return { appointmentId, faxNumber: `+1${faxNumber}`, secrets: input.secrets };
}
