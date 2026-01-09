import { VALUE_SETS } from 'utils';
import { ZambdaInput } from '../../../shared';
import { CancelTelemedAppointmentInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CancelTelemedAppointmentInputValidated {
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
      VALUE_SETS.cancelReasonOptionsVirtual.some((option) => option.value === cancellationReason) ||
      VALUE_SETS.cancelReasonOptionsVirtualProviderSide.some((option) => option.value === cancellationReason)
    )
  ) {
    throw new Error(
      `"cancellationReason" must be one of the following values: ${JSON.stringify(
        VALUE_SETS.cancelReasonOptionsVirtual.map((option) => option.value),
        VALUE_SETS.cancelReasonOptionsVirtualProviderSide.map((option) => option.value)
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
