import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { CheckInInputValidated } from '.';

const CheckInBodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): CheckInInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { appointmentId } = safeValidate(CheckInBodySchema, safeJsonParse(input.body));

  return { appointmentId, secrets: input.secrets };
}
