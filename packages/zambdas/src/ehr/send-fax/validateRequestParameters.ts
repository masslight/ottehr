import { INVALID_INPUT_ERROR, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { SendFaxZambdaInput } from 'utils/lib/types/api/send-fax.types';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
