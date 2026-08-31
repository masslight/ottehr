import { GetTelemedAppointmentsRequest } from 'utils/lib/types/data/telemed/appointments/appointments.types';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const TelemedGetAppointmentsBodySchema = z.object({
  patientId: z.string().uuid().optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): GetTelemedAppointmentsRequest & Pick<ZambdaInput, 'secrets'> {
  const rawBody = input.body ? safeJsonParse(input.body) : {};
  const { patientId } = safeValidate(TelemedGetAppointmentsBodySchema, rawBody);

  return {
    patientId,
    secrets: input.secrets,
  };
}
