import { GetVisitDetailsRequest } from 'utils/lib/types/data/telemed/appointments/appointments.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const GetVisitDetailsBodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetVisitDetailsRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentId } = safeValidate(GetVisitDetailsBodySchema, safeJsonParse(input.body));

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
