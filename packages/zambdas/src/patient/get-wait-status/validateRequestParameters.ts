import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { WaitingRoomInput } from 'utils/lib/types/data/get-wait-status.types';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): WaitingRoomInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID } = safeValidate(bodySchema, parsed);

  const authorization = input.headers.Authorization;

  return {
    appointmentID,
    secrets: input.secrets,
    authorization,
  };
}
