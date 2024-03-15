import { InitTelemedSessionRequestParams } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(
  input: ZambdaInput,
): InitTelemedSessionRequestParams & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, userId } = JSON.parse(input.body);

  if (appointmentId === undefined) {
    throw new Error('These fields are required: "appointmentId"');
  }

  if (userId === undefined) {
    throw new Error('These fields are required: "userName"');
  }

  return {
    appointmentId: appointmentId,
    userId: userId,
    secrets: input.secrets,
  };
}
