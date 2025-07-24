import Oystehr from '@oystehr/sdk';
import { Address, Appointment, Encounter, Location } from 'fhir/r4b';
import {
  getEncounterForAppointment,
  getVirtualServiceResourceExtension,
  SLUG_SYSTEM,
  TELEMED_VIDEO_ROOM_CODE,
  VisitType,
} from 'utils';
import { getParticipantFromAppointment } from '../shared';

export const getVideoEncounterForAppointment = async (
  appointmentID: string,
  oystehr: Oystehr
): Promise<Encounter | undefined> => {
  let encounter: Encounter | undefined = undefined;

  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: 'appointment',
          value: `Appointment/${appointmentID}`,
        },
      ],
    })
  ).unbundle();

  encounter = (encounters ?? []).find((encounterTemp) =>
    Boolean(getVirtualServiceResourceExtension(encounterTemp, TELEMED_VIDEO_ROOM_CODE))
  );
  return encounter;
};

interface EncounterDetails {
  encounter: Encounter;
  curStatusHistoryIdx: number;
  canceledHistoryIdx: number;
  location: LocationInformation;
  visitType: VisitType;
  appointmentStart: string | undefined;
  appointment: Appointment;
  patientID: string | undefined;
}

export interface LocationInformation {
  name: string;
  slug: string;
  state: string;
  timezone: string;
  address: Address | undefined;
}

export const getEncounterDetails = async (appointmentID: string, oystehr: Oystehr): Promise<EncounterDetails> => {
  let curStatusHistoryIdx, location, visitType, appointmentStart, patientID, canceledHistoryIdx;
  const encounter = await getEncounterForAppointment(appointmentID, oystehr);
  let appointment: Appointment | undefined = undefined;
  console.log('Got encounter with id', encounter.id);
  if (encounter.statusHistory) {
    curStatusHistoryIdx = encounter.statusHistory.findIndex((history) => !history.period.end);
    canceledHistoryIdx = encounter.statusHistory.findIndex(
      (history) => history.status === 'cancelled' && !history.period.end
    );
  } else {
    throw new Error('Encounter status history not found');
  }

  try {
    const locationId = encounter.location?.[0]?.location.reference?.replace('Location/', '') || '';
    const fhirLocation: Location = await oystehr.fhir.get({
      resourceType: 'Location',
      id: locationId,
    });
    location = {
      name: fhirLocation?.name || 'Unknown',
      slug:
        fhirLocation.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value || 'Unknown',
      state: fhirLocation.address?.state || 'Unknown',
      timezone:
        fhirLocation.extension?.find((extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone')
          ?.valueString || 'Unknown',
      address: fhirLocation?.address ?? undefined,
    };
  } catch {
    throw new Error('Error getting location details');
  }
  try {
    appointment = (await oystehr.fhir.get({
      resourceType: 'Appointment',
      id: appointmentID,
    })) as Appointment;
    if (!appointment) {
      throw new Error('error searching for appointment resource');
    }
    patientID = getParticipantFromAppointment(appointment, 'Patient');
    appointmentStart = appointment.start;
    visitType = (appointment.appointmentType?.text as VisitType) || 'Unknown';
  } catch {
    throw new Error('Error getting appointment details');
  }

  return {
    encounter,
    curStatusHistoryIdx,
    canceledHistoryIdx,
    location,
    visitType,
    appointmentStart,
    appointment,
    patientID,
  };
};
