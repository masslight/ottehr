import { GetVisitDetailsRequest, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
