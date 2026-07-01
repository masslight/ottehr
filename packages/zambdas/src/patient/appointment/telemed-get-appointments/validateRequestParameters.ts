import { GetTelemedAppointmentsRequest } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
