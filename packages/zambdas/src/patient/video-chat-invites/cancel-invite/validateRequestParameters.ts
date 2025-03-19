import { CancelInviteParticipantRequestInput, emailRegex, phoneRegex } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): CancelInviteParticipantRequestInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, emailAddress, phoneNumber } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  if (!emailAddress && !phoneNumber) {
    throw new Error('emailAddress or phoneNumber is not defined');
  }

  if (emailAddress && !emailRegex.test(emailAddress)) {
    throw new Error('emailAddress is not valid');
  }

  if (phoneNumber && !phoneRegex.test(phoneNumber)) {
    throw new Error('phoneNumber is not valid');
  }

  return {
    appointmentId,
    emailAddress,
    phoneNumber,
    secrets: input.secrets,
  };
}
