import { FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter, Location } from 'fhir/r4';
import {
  getParticipantFromAppointment,
  getVirtualServiceResourceExtension,
  getEncounterForAppointment,
} from 'ottehr-utils';

interface EncounterDetails {
  encounter: Encounter;
  plannedHistoryIdx: number;
  location: { name: string; slug: string; timezone: string };
  visitType: string;
  appointmentStart: string | undefined;
  patientID: string | undefined;
}

export const getVideoEncounterForAppointment = async (
  appointmentID: string,
  fhirClient: FhirClient,
): Promise<Encounter | undefined> => {
  let encounter: Encounter | undefined = undefined;

  const encounters: Encounter[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentID}`,
      },
    ],
  });

  encounter = (encounters ?? []).find((encounterTemp) =>
    Boolean(getVirtualServiceResourceExtension(encounterTemp, 'twilio-video-group-rooms')),
  );
  return encounter;
};

export const getEncounterDetails = async (appointmentID: string, fhirClient: FhirClient): Promise<EncounterDetails> => {
  let plannedIdx, location, visitType, appointmentStart, patientID;
  const encounter = await getEncounterForAppointment(appointmentID, fhirClient);
  console.log('Got encounter with id', encounter.id);
  if (encounter.statusHistory) {
    const plannedHistory = encounter.statusHistory?.find((history) => history.status === 'planned');
    plannedIdx = plannedHistory ? encounter.statusHistory.indexOf(plannedHistory) : -1;
  } else {
    throw new Error('Encounter status history not found');
  }

  try {
    const locationId = encounter.location?.[0]?.location.reference?.replace('Location/', '') || '';
    const fhirLocation: Location = await fhirClient.readResource({
      resourceType: 'Location',
      resourceId: locationId,
    });
    location = {
      name: fhirLocation?.name || 'Unknown',
      slug:
        fhirLocation.identifier?.find((identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug')
          ?.value || 'Unknown',
      timezone:
        fhirLocation.extension?.find((extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone')
          ?.valueString || 'Unknown',
    };
  } catch (error: any) {
    throw new Error('Error getting location details');
  }
  try {
    const appointment: Appointment = await fhirClient.readResource({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    });
    patientID = getParticipantFromAppointment(appointment, 'Patient');
    appointmentStart = appointment.start;
    visitType =
      appointment.appointmentType?.coding
        ?.find((codingTemp) => codingTemp.system === 'http://terminology.hl7.org/CodeSystem/v2-0276')
        ?.code?.toLowerCase() || 'Unknown';
  } catch (error: any) {
    throw new Error('Error getting appointment details');
  }

  return { encounter, plannedHistoryIdx: plannedIdx, location, visitType, appointmentStart, patientID };
};
