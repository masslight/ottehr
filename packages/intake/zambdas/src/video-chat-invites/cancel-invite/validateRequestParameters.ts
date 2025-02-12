import { CancelInviteParticipantRequestInput, emailRegex } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): CancelInviteParticipantRequestInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, emailAddress } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  if (!emailAddress) {
    throw new Error('emailAddress is not defined');
  }

  if (!emailRegex.test(emailAddress)) {
    throw new Error('emailAddress is not valid');
  }

  return {
    appointmentId,
    emailAddress,
    secrets: input.secrets,
  };
}
