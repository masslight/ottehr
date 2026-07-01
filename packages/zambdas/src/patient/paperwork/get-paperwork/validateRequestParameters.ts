import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';
import { GetPaperworkInput } from '.';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
  dateOfBirth: z.string().date().optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetPaperworkInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, dateOfBirth } = safeValidate(bodySchema, parsed);

  const authorization = input.headers.Authorization;

  return {
    appointmentID,
    dateOfBirth,
    secrets: input.secrets,
    authorization,
  };
}
