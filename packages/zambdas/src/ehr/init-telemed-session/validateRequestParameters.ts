import { InitTelemedSessionRequestParams, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const InitTelemedSessionSchema = z.object({
  appointmentId: z.string().uuid(),
  userId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): InitTelemedSessionRequestParams & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = JSON.parse(input.body);

  const { appointmentId, userId } = safeValidate(InitTelemedSessionSchema, parsedJSON);

  return {
    appointmentId,
    userId,
    secrets: input.secrets,
  };
}
