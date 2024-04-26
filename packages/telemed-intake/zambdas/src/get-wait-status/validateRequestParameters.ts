import { WaitingRoomInput, ZambdaInput } from 'ottehr-utils';

export function validateRequestParameters(input: ZambdaInput): WaitingRoomInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID } = JSON.parse(input.body);

  if (!appointmentID) {
    throw new Error('appointmentID is not defined');
  }

  const authorization = input.headers.Authorization;

  return {
    appointmentID,
    secrets: input.secrets,
    authorization,
  };
}
