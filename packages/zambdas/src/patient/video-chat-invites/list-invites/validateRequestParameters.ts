import { ListInvitedParticipantsInput } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): ListInvitedParticipantsInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
