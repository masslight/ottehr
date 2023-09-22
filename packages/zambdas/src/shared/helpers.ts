import { DateTime } from 'luxon';
import { AppClient, FhirClient, ClientConfig, MessagingClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function createFhirClient(token: string): FhirClient {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: process.env.FHIR_API,
    accessToken: token,
  };
  console.log(CLIENT_CONFIG);
  return new FhirClient(CLIENT_CONFIG);
}

export function createAppClient(token: string): AppClient {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: process.env.PROJECT_API,
    accessToken: token,
  };
  return new AppClient(CLIENT_CONFIG);
}

export function createMessagingClient(token: string): MessagingClient {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: process.env.PROJECT_API,
    accessToken: token,
  };
  return new MessagingClient(CLIENT_CONFIG);
}

export function getParticipantFromAppointment(appointment: Appointment, participant: string): string {
  const participantTemp = appointment.participant
    .find((currentParticipant: any) => currentParticipant.actor?.reference?.startsWith(participant))
    ?.actor?.reference?.replace(`${participant}/`, '');
  console.log(participantTemp, appointment, appointment.participant, participant);
  if (!participantTemp) {
    throw new Error('Participant not found in list of appointment participants');
  }

  return participantTemp;
}

export function getAppointmentConfirmationMessage(locationName: string, date: DateTime): string {
  return `You're confirmed! Thank you for booking! Your check-in time at ${locationName} is on ${date.toLocaleString(
    DateTime.DATE_MED
  )} at ${date.toLocaleString(DateTime.TIME_WITH_SHORT_OFFSET)}.`;
}
