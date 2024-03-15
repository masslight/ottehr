import { FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter } from 'fhir/r4';
import { AppointmentPackage } from './types';
import { getVideoRoomResourceExtension } from '../../shared/helpers';

export const getVideoResources = async (
  fhirClient: FhirClient,
  appointmentId: string,
): Promise<AppointmentPackage | undefined> => {
  const allResources = await fhirClient.searchResources({
    resourceType: 'Appointment',
    searchParams: [
      {
        name: '_id',
        value: appointmentId,
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
    ],
  });

  const appointment = allResources.find((resource) => resource.resourceType === 'Appointment');
  if (!appointment) return undefined;
  if (!getVideoRoomResourceExtension(appointment)) return undefined;
  const encounter = allResources.find(
    (resource) => resource.resourceType === 'Encounter' && getVideoRoomResourceExtension(resource),
  );
  if (!encounter) return undefined;

  return {
    appointment: appointment as Appointment,
    encounter: encounter as Encounter,
  };
};
