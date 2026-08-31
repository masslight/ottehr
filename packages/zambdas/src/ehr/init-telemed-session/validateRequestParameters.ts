import { InitTelemedSessionRequestParams } from 'utils/lib/types/api/init-telemed-session/init-telemed-session.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const parsedJSON = safeJsonParse(input.body);

  const { appointmentId, userId } = safeValidate(InitTelemedSessionSchema, parsedJSON);

  return {
    appointmentId,
    userId,
    secrets: input.secrets,
  };
}
