import { isISODateTime } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { UpdateAppointmentInput } from '.';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): UpdateAppointmentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, language, slot } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (appointmentID === undefined || slot === undefined) {
    throw new Error('These fields are required: "appointmentID", "slot"');
  }

  if (!isISODateTime(slot)) {
    throw new Error(`"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS)`);
  }

  return {
    appointmentID,
    slot,
    language,
    secrets: input.secrets,
  };
}
