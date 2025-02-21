import { CancellationReasonOptionsInPerson, CancellationReasonOptionsTelemedEHR } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { CancelAppointmentInput } from '.';

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { language, appointmentID, cancellationReason, silent } = JSON.parse(input.body);

  if (appointmentID === undefined || cancellationReason === undefined) {
    throw new Error('These fields are required: "appointmentID", "cancellationReason"');
  }

  const validReasons = [
    ...Object.values(CancellationReasonOptionsInPerson),
    ...Object.values(CancellationReasonOptionsTelemedEHR),
  ];

  if (!validReasons.includes(cancellationReason)) {
    throw new Error(`"cancellationReason" must be one of the following values: ${JSON.stringify(validReasons)}`);
  }

  return {
    appointmentID,
    cancellationReason,
    silent,
    secrets: input.secrets,
    language,
  };
}
