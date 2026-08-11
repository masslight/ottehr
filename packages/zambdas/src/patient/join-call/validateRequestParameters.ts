import { JoinCallInput } from 'utils/lib/types/data/telemed/join-call.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const bodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): JoinCallInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentId } = safeValidate(bodySchema, parsed);

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
