import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { CheckInInputValidated } from '.';

const CheckInBodySchema = z.object({
  appointmentId: z.string(),
});

export function validateRequestParameters(input: ZambdaInput): CheckInInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = safeValidate(CheckInBodySchema, JSON.parse(input.body));

  if (!input.secrets) {
    throw new Error('secrets were not available');
  }

  return { appointmentId, secrets: input.secrets };
}
