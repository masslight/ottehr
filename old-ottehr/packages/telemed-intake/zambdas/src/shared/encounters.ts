import { FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter, Location } from 'fhir/r4';
import {
  TELEMED_VIDEO_ROOM_CODE,
  getEncounterForAppointment,
  getParticipantFromAppointment,
  getVirtualServiceResourceExtension,
} from 'ottehr-utils';
import { TIMEZONE_EXTENSION_URL } from './fhir';

interface EncounterDetails {
  encounter: Encounter;
  plannedHistoryIdx: number;
  canceledHistoryIdx: number;
  arrivedHistoryIdx: number;
  location: { name: string; slug: string; timezone: string };
  visitType: string;
  appointmentStart: string | undefined;
  patientID: string | undefined;
  appointment: Appointment | undefined;
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

  // encounter = (encounters ?? []).find((encounterTemp) =>
  //   Boolean(getVirtualServiceResourceExtension(encounterTemp, TELEMED_VIDEO_ROOM_CODE)),
  // );
  encounter = encounters[0];
  return encounter;
};

export const getEncounterDetails = async (appointmentID: string, fhirClient: FhirClient): Promise<EncounterDetails> => {
  let plannedIdx, location, visitType, appointmentStart, patientID, arrivedHistoryIdx, canceledHistoryIdx;
  const encounter = await getEncounterForAppointment(appointmentID, fhirClient);
  let appointment: Appointment | undefined = undefined;
  console.log('Got encounter with id', encounter.id);
  if (encounter.statusHistory) {
    plannedIdx = encounter.statusHistory.findIndex((history) => history.status === 'planned' && !history.period.end);
    arrivedHistoryIdx = encounter.statusHistory.findIndex(
      (history) => history.status === 'arrived' && !history.period.end,
    );
    canceledHistoryIdx = encounter.statusHistory.findIndex(
      (history) => history.status === 'cancelled' && !history.period.end,
    );
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
        fhirLocation.identifier?.find(
          (identifierTemp) => identifierTemp.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
        )?.value || 'Unknown',
      timezone:
        fhirLocation.extension?.find((extTemp) => extTemp.url === TIMEZONE_EXTENSION_URL)?.valueString || 'Unknown',
    };
  } catch (error: any) {
    throw new Error('Error getting location details');
  }
  try {
    appointment = (await fhirClient.readResource({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    })) as Appointment;
    if (!appointment) {
      throw new Error('error searching for appointment resource');
    }
    patientID = getParticipantFromAppointment(appointment, 'Patient');
    appointmentStart = appointment.start;
    visitType =
      appointment.appointmentType?.coding
        ?.find((codingTemp) => codingTemp.system === 'http://terminology.hl7.org/CodeSystem/v2-0276')
        ?.code?.toLowerCase() || 'Unknown';
  } catch (error: any) {
    throw new Error('Error getting appointment details');
  }

  return {
    encounter,
    plannedHistoryIdx: plannedIdx,
    arrivedHistoryIdx,
    canceledHistoryIdx,
    location,
    visitType,
    appointmentStart,
    appointment,
    patientID,
  };
};
