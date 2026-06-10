import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';
import { GetPatientsInput } from '.';

const PrebookGetAppointmentsBodySchema = z.object({
  patientID: z.string().uuid().optional(),
  dateRange: z
    .object({
      greaterThan: z.string().min(1),
      lessThan: z.string().min(1),
    })
    .optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  if (!input.body) {
    return { secrets: input.secrets };
  }

  const { patientID, dateRange } = safeValidate(PrebookGetAppointmentsBodySchema, JSON.parse(input.body));

  return {
    patientID,
    dateRange,
    secrets: input.secrets,
  };
}
