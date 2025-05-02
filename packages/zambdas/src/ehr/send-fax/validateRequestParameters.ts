import { isPhoneNumberValid, SendFaxZambdaInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as SendFaxZambdaInput;

  if (input.headers.Authorization === undefined) {
    throw new Error('AuthToken is not provided in headers');
  }
  const { appointmentId, faxNumber } = data;

  if (!appointmentId) {
    throw new Error('Appointment ID is not provided');
  }
  if (!faxNumber) {
    throw new Error('Fax number is not provided');
  }
  if (!isPhoneNumberValid(faxNumber)) {
    throw new Error('Fax number is not valid');
  }

  return { appointmentId, faxNumber: `+1${faxNumber}`, secrets: input.secrets };
}
