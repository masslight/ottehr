import { CancellationReasonOptionsProviderSideTelemed, CancellationReasonOptionsTelemed } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { CancelAppointmentInput } from '.';

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentInput {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, cancellationReason, cancellationReasonAdditional } = JSON.parse(input.body);

  if (appointmentID === undefined || cancellationReason === undefined) {
    throw new Error('These fields are required: "appointmentID", "cancellationReason"');
  }

  if (
    !(
      Object.values(CancellationReasonOptionsTelemed).includes(cancellationReason) ||
      Object.values(CancellationReasonOptionsProviderSideTelemed).includes(cancellationReason)
    )
  ) {
    throw new Error(
      `"cancellationReason" must be one of the following values: ${JSON.stringify(
        Object.values(CancellationReasonOptionsTelemed),
        Object.values(CancellationReasonOptionsProviderSideTelemed)
      )}`
    );
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentID,
    cancellationReason,
    cancellationReasonAdditional,
    secrets: input.secrets,
  };
}
