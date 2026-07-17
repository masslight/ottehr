import {
  INVALID_INPUT_ERROR,
  isPhoneNumberValid,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  SendFaxZambdaInput,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const SendFaxBodySchema = z.object({
  appointmentId: z.string().uuid(),
  faxNumber: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeJsonParse(input.body);
  const { appointmentId, faxNumber } = safeValidate(SendFaxBodySchema, data);

  if (!isPhoneNumberValid(faxNumber)) {
    throw INVALID_INPUT_ERROR('"faxNumber" is not a valid phone number');
  }

  return { appointmentId, faxNumber: `+1${faxNumber}`, secrets: input.secrets };
}
