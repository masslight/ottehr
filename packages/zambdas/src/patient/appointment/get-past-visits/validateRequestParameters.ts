import { GetAppointmentsRequest } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
