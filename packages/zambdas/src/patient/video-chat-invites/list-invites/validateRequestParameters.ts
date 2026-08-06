import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ListInvitedParticipantsInput } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

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
