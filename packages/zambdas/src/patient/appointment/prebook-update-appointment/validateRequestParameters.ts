import { INVALID_INPUT_ERROR, isISODateTime, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';
import { UpdateAppointmentInput } from '.';

const PrebookUpdateAppointmentBodySchema = z.object({
  appointmentID: z.string().uuid(),
  slot: z
    .object({
      start: z.string().min(1),
    })
    .passthrough(),
  language: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): UpdateAppointmentInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentID, slot, language } = safeValidate(PrebookUpdateAppointmentBodySchema, JSON.parse(input.body));

  if (!isISODateTime(slot.start)) {
    throw INVALID_INPUT_ERROR(`"slot.start" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS)`);
  }

  return {
    appointmentID,
    slot: slot as unknown as UpdateAppointmentInput['slot'],
    language: language as string,
    secrets: input.secrets,
  };
}
