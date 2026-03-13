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

  /*
   TODO: this validation should be context aware like in prebook-cancel-appointment
   e.g. is the requester a patient or provider, because only one of these value sets can 
   be correct for the appointment context.  For now, we will just check that the reason is in either of the two 
   virtual appointment value sets.

   It's also worth asking whether a separate endpoint is needed for telemed vs in-person appointment cancellations. 
  */

  if (
    !(
      VALUE_SETS.cancelReasonOptionsVirtualPatient.some((option) => option.value === cancellationReason) ||
      VALUE_SETS.cancelReasonOptionsVirtualProvider.some((option) => option.value === cancellationReason)
    )
  ) {
    throw new Error(
      `"cancellationReason" must be one of the following values: ${JSON.stringify(
        VALUE_SETS.cancelReasonOptionsVirtualPatient.map((option) => option.value),
        VALUE_SETS.cancelReasonOptionsVirtualProvider.map((option) => option.value)
      )} and received ${cancellationReason}`
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
