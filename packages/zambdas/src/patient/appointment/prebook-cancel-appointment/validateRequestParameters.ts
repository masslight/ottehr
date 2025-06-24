import {
  CancellationReasonOptionsInPerson,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils';
import { ZambdaInput } from '../../../shared';
import { CancelAppointmentZambdaInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentZambdaInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { language, appointmentID, cancellationReason, silent } = JSON.parse(input.body);

  const missingFields = [];
  if (appointmentID === undefined) {
    missingFields.push('appointmentID');
  }
  if (cancellationReason === undefined) {
    missingFields.push('cancellationReason');
  }
  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  const validReasons = Object.values(CancellationReasonOptionsInPerson);

  if (!validReasons.includes(cancellationReason)) {
    throw INVALID_INPUT_ERROR(
      `"cancellationReason" must be one of the following values: ${JSON.stringify(validReasons)}`
    );
  }

  return {
    appointmentID,
    cancellationReason,
    silent,
    secrets: input.secrets,
    language,
  };
}
