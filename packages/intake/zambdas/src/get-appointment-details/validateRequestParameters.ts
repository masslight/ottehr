import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { GetAppointmentDetailInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetAppointmentDetailInput {
  const { appointmentID } = JSON.parse(input.body || '');
  return {
    appointmentID: appointmentID,
    secrets: input.secrets,
  };
}
