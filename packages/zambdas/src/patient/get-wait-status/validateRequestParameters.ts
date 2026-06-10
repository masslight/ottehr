import { MISSING_REQUEST_BODY, Secrets, WaitingRoomInput } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): WaitingRoomInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body);
  const { appointmentID } = safeValidate(bodySchema, parsed);

  const authorization = input.headers.Authorization;

  return {
    appointmentID,
    secrets: input.secrets,
    authorization,
  };
}
