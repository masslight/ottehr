import { GetAppointmentsRequest } from 'utils/lib/types/data/appointments/appointments.types';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const GetPastVisitsBodySchema = z.object({
  patientId: z.string().uuid().optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsRequest & Pick<ZambdaInput, 'secrets'> {
  const body = input.body ? safeValidate(GetPastVisitsBodySchema, safeJsonParse(input.body)) : {};

  return {
    patientId: body.patientId,
    secrets: input.secrets,
  };
}
