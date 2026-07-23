import { INVALID_INPUT_ERROR, ListInvitedParticipantsInput } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

const ListInvitesBodySchema = z.object({
  appointmentId: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): ListInvitedParticipantsInput {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { appointmentId } = safeValidate(ListInvitesBodySchema, safeJsonParse(input.body));

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
