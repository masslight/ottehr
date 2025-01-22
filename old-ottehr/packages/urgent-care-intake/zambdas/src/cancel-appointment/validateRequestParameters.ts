import { ZambdaInput } from 'ottehr-utils';
import { CancelAppointmentInput } from '.';
import { CancellationReasonOptions } from '../types';

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, cancellationReason } = JSON.parse(input.body);

  if (appointmentID === undefined || cancellationReason === undefined) {
    throw new Error('These fields are required: "appointmentID", "cancellationReason"');
  }

  if (!Object.values(CancellationReasonOptions).includes(cancellationReason)) {
    throw new Error(
      `"cancellationReason" must be one of the following values: ${JSON.stringify(
        Object.values(CancellationReasonOptions),
      )}`,
    );
  }

  return {
    appointmentID,
    cancellationReason,
    secrets: input.secrets,
  };
}
