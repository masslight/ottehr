import { AppClient, ClientConfig, FhirClient, MessagingClient, Z3Client } from '@zapehr/sdk';
import { Appointment, Extension } from 'fhir/r4';
import { DateTime } from 'luxon';

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function createFhirClient(token: string, fhirAPI: string): FhirClient {
  const FHIR_API = fhirAPI.replace(/\/r4/g, '');
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: FHIR_API,
    accessToken: token,
  };
  console.log('creating fhir client');
  return new FhirClient(CLIENT_CONFIG);
}

export function createAppClient(token: string, projectAPI: string): AppClient {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: projectAPI,
    accessToken: token,
  };
  console.log('creating app client', JSON.stringify(CLIENT_CONFIG));
  return new AppClient(CLIENT_CONFIG);
}

export function createMessagingClient(token: string, projectAPI: string): MessagingClient {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: projectAPI,
    accessToken: token,
  };
  console.log('creating messaging client');
  return new MessagingClient(CLIENT_CONFIG);
}

export function createZ3Client(token: string, projectAPI: string): Z3Client {
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: projectAPI,
    accessToken: token,
  };
  console.log('creating Z3 client');
  return new Z3Client(CLIENT_CONFIG);
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

export function getAppointmentConfirmationMessage(
  appointmentID: string,
  locationName: string,
  startTime: string,
  websiteURL: string,
): string {
  return `You're confirmed! Thanks for choosing Ottehr Urgent Care! Your check-in time at ${locationName} is on ${startTime}. To edit your paperwork or modify/cancel your check-in, please visit: ${websiteURL}/appointment/${appointmentID}`;
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

const getExtensionStartTimeValue = (extension: Extension): string | undefined =>
  extension?.extension?.find((element: any) => element.url === 'startTime')?.valueTime;
const getExtensionCapacityValue = (extension: Extension): number | undefined =>
  extension?.extension?.find((element: any) => element.url === 'capacity')?.valueUnsignedInt;

export function findFirstAndLastTimeSlot(arr: Extension[]): {
  firstFulfillmentIndex: number;
  lastFulfillmentIndex: number;
} {
  let firstFulfillmentIndex = -1;
  let lastFulfillmentIndex = -1;

  for (let i = 0; i < arr.length; i++) {
    const hourStart = getExtensionStartTimeValue(arr[i]);
    const capacity = getExtensionCapacityValue(arr[i]);

    if (!hourStart || !capacity) {
      continue;
    }

    if (firstFulfillmentIndex === -1) {
      firstFulfillmentIndex = i;
    }

    lastFulfillmentIndex = i;
  }

  return { firstFulfillmentIndex, lastFulfillmentIndex };
}

// https://stackoverflow.com/a/13653180/2150542
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isValidUUID = (maybeUUID: string): boolean => {
  return uuidRegex.test(maybeUUID);
};

export const deepCopy = <T extends object>(source: T): T => {
  return JSON.parse(JSON.stringify(source));
};
