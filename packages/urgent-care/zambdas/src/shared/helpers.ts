import { DateTime } from 'luxon';
import { AppClient, FhirClient, ClientConfig, MessagingClient, Z3Client } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';
import { Secrets, getSecret, SecretsKeys } from 'utils';

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function createFhirClient(token: string, secrets: Secrets | null): FhirClient {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: FHIR_API,
    accessToken: token,
  };
  console.log('creating fhir client');
  return new FhirClient(CLIENT_CONFIG);
}

export function createAppClient(token: string, secrets: Secrets | null): AppClient {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: PROJECT_API,
    accessToken: token,
  };
  console.log('creating app client', JSON.stringify(CLIENT_CONFIG));
  return new AppClient(CLIENT_CONFIG);
}

export function createMessagingClient(token: string, secrets: Secrets | null): MessagingClient {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: PROJECT_API,
    accessToken: token,
  };
  console.log('creating messaging client');
  return new MessagingClient(CLIENT_CONFIG);
}

export function createZ3Client(token: string, secrets: Secrets | null): Z3Client {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: PROJECT_API,
    accessToken: token,
  };
  console.log('creating Z3 client');
  return new Z3Client(CLIENT_CONFIG);
}

export function getParticipantFromAppointment(appointment: Appointment, participant: string): string {
  const participantTemp = appointment.participant
    .find((currentParticipant: any) => currentParticipant.actor?.reference?.startsWith(participant))
    ?.actor?.reference?.replace(`${participant}/`, '');

  if (!participantTemp) {
    throw new Error('Participant not found in list of appointment participants');
  }

  return participantTemp;
}

export function checkValidBookingTime(slotTime: string): boolean {
  const slotDate = DateTime.fromISO(slotTime);

  const currentDate = DateTime.now().setZone('UTC');

  return slotDate > currentDate;
}

export function getBucketAndObjectFromZ3URL(z3URL: string, projectAPI: string): { bucket: string; object: string } {
  const updatedPhotoIdFrontUrl = z3URL.replace(`${projectAPI}/z3/object/`, '');
  const photoIdFrontItems = updatedPhotoIdFrontUrl.split('/');
  const bucket = photoIdFrontItems[0];
  const object = photoIdFrontItems.slice(1).join('/');
  return { bucket, object };
}

export function formatPhoneNumber(phoneNumber: string): string {
  const plusOneRegex = /^\+1\d{10}$/;
  const tenDigitRegex = /^\d{10}$/;
  if (plusOneRegex.test(phoneNumber)) {
    return phoneNumber;
  } else if (tenDigitRegex.test(phoneNumber)) {
    return `+1${phoneNumber}`;
  } else {
    throw new Error('Failed to format phone number');
  }
}
