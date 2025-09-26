import { INVALID_INPUT_ERROR, isISODateTime, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';
import { UpdateAppointmentInput } from '.';

export function validateRequestParameters(input: ZambdaInput): UpdateAppointmentInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentID, language, slot } = JSON.parse(input.body);

  const missingFields = [];
  if (appointmentID === undefined) {
    missingFields.push('appointmentID');
  }
  if (slot === undefined) {
    missingFields.push('slot');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (!isISODateTime(slot.start)) {
    throw INVALID_INPUT_ERROR(`"slot.start" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS)`);
  }

  return {
    appointmentID,
    slot,
    language,
    secrets: input.secrets,
  };
}
