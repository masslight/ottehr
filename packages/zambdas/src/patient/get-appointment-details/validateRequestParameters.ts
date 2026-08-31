import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { GetAppointmentDetailInput } from '.';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetAppointmentDetailInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID } = safeValidate(bodySchema, parsed);

  return {
    appointmentID,
    secrets: input.secrets,
  };
}
