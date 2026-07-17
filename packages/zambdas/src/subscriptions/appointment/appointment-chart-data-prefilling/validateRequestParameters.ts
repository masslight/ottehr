import { Appointment } from 'fhir/r4b';
import { safeJsonParse, ZambdaInput } from '../../../shared';
import { AppointmentSubscriptionInput } from '.';

export function validateRequestParameters(input: ZambdaInput): AppointmentSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const appointment = safeJsonParse(input.body) as Appointment;

  if (appointment.resourceType !== 'Appointment') {
    throw new Error(`resource parsed should be an appointment but was a ${appointment.resourceType}`);
  }

  return {
    appointment,
    secrets: input.secrets,
  };
}
