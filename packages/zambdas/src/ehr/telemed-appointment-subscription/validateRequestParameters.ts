import { ZambdaInput } from 'zambda-utils';
import { AppointmentSubscriptionInput } from '.';
import { Appointment } from 'fhir/r4b';

export function validateRequestParameters(input: ZambdaInput): AppointmentSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const appointment = JSON.parse(input.body) as Appointment;

  if (appointment.resourceType !== 'Appointment') {
    throw new Error(`resource parsed should be a communication but was a ${appointment.resourceType}`);
  }

  return {
    appointment,
    secrets: input.secrets,
  };
}
