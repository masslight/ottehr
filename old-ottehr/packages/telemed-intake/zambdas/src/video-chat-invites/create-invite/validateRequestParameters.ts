import { ZambdaInput, emailRegex, Secrets, VideoChatCreateInviteInput } from 'ottehr-utils';
import { phoneRegex } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): VideoChatCreateInviteInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, firstName, lastName, phoneNumber, emailAddress } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  if (!firstName) {
    throw new Error('firstName is not defined');
  }

  if (!lastName) {
    throw new Error('lastName is not defined');
  }

  if (!phoneNumber) {
    throw new Error('phoneNumber is not defined');
  }

  // TODO: Temporary disable it. Currently front-end sends in (xxx) xxxx-xxx format. Fix front-end.
  //if (!phoneRegex.test(phoneNumber)) {
  //  throw new Error('phoneNumber is not valid');
  //}

  if (!emailAddress) {
    throw new Error('emailAddress is not defined');
  }

  if (!emailRegex.test(emailAddress)) {
    throw new Error('emailAddress is not valid');
  }

  return {
    appointmentId,
    firstName,
    lastName,
    phoneNumber,
    emailAddress,
    secrets: input.secrets,
  };
}
