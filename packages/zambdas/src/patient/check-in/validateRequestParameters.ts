import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';
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
