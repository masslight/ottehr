import { FhirClient } from '@zapehr/sdk';
import { Encounter } from 'fhir/r4';

export const getEncounterForAppointment = async (appointmentID: string, fhirClient: FhirClient): Promise<Encounter> => {
  const encounterTemp: Encounter[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentID}`,
      },
    ],
  });
  const encounter = encounterTemp[0];
  if (encounterTemp.length === 0 || !encounter.id) {
    throw new Error('Error getting appointment encounter');
  }
  return encounter;
};
