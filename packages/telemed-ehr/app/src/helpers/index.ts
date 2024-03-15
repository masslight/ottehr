import { Message } from '@twilio/conversations';
import { FhirClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';
import { AppointmentInformation } from '../types/types';
import { getPatchOperationsToUpdateVisitStatus } from './mappingUtils';

export const classifyAppointments = (appointments: AppointmentInformation[]): Map<any, any> => {
  const statusCounts = new Map();

  appointments.forEach((appointment) => {
    const { status } = appointment;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  return statusCounts;
};

export const messageIsFromPatient = (message: Message): boolean => {
  return message.author?.startsWith('+') ?? false;
};

export const checkinPatient = async (fhirClient: FhirClient, appointmentId: string): Promise<void> => {
  const appointmentToUpdate = await fhirClient.readResource<Appointment>({
    resourceType: 'Appointment',
    resourceId: appointmentId,
  });
  const statusOperations = getPatchOperationsToUpdateVisitStatus(appointmentToUpdate, 'ARRIVED');

  await fhirClient.patchResource({
    resourceType: 'Appointment',
    resourceId: appointmentId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'arrived',
      },
      ...statusOperations,
    ],
  });
};

export const sortLocationsByLabel = (
  locations: { label: string; value: string }[],
): { label: string; value: string }[] => {
  function compare(a: { label: string; value: string }, b: { label: string; value: string }): number {
    const labelA = a.label.toUpperCase();
    const labelB = b.label.toUpperCase();

    if (labelA < labelB) {
      return -1;
    }
    if (labelA > labelB) {
      return 1;
    }
    return 0;
  }

  locations.sort(compare);

  return locations;
};
