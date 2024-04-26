import { ZambdaInput } from 'ottehr-utils';
import { UpdateAppointmentInput } from '.';
import { isISODateTime } from '../shared/dateUtils';

export function validateRequestParameters(input: ZambdaInput): UpdateAppointmentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, slot } = JSON.parse(input.body);

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
    secrets: input.secrets,
  };
}
