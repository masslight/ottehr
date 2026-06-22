import { JoinCallInput, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const bodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): JoinCallInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body);
  const { appointmentId } = safeValidate(bodySchema, parsed);

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
