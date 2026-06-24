import Oystehr from '@oystehr/sdk';
import { Address, Appointment, Encounter, Location } from 'fhir/r4b';
import {
  getVirtualServiceResourceExtension,
  isFollowupEncounter,
  SLUG_SYSTEM,
  TELEMED_VIDEO_ROOM_CODE,
  VisitType,
} from 'utils';
import { getParticipantFromAppointment } from '../shared';

/**
 * Fetches the appointment's encounters and returns the main one whose lifecycle we act on (e.g. on cancel).
 *
 * An appointment can be referenced by several encounters, so we pick by statusHistory + type:
 *
 * - Regular visit: exactly one non-follow-up encounter with statusHistory → return it. Annotation
 *   follow-ups (lab-result etc.) attached to the same appointment have no statusHistory and are ignored.
 *
 * - Scheduled follow-up appointment: no visit encounter, but owns a single follow-up encounter with
 *   statusHistory → return that one.
 *
 * NOTE: this relies on follow-up visits being modeled as above (annotation follow-ups without
 * statusHistory, scheduled follow-ups owning their own appointment with a single encounter). If that
 * structure changes, update this logic to keep the selection algorithm valid.
 */
const fetchMainEncounter = async (appointmentID: string, oystehr: Oystehr): Promise<Encounter> => {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentID}` }],
    })
  ).unbundle();

  const withStatusHistory = encounters.filter((enc) => enc.statusHistory?.length);

  if (withStatusHistory.length === 0) {
    throw new Error('Encounter status history not found');
  }

  const mainEncounters = withStatusHistory.filter((enc) => !isFollowupEncounter(enc));

  if (mainEncounters.length > 1) {
    throw new Error('Multiple main encounters with statusHistory');
  }

  if (mainEncounters.length === 1) {
    return mainEncounters[0];
  }

  // No main encounter → scheduled follow-up appointment, which owns its single follow-up encounter.
  const followupEncounters = withStatusHistory.filter((enc) => isFollowupEncounter(enc));

  if (followupEncounters.length > 1) {
    throw new Error('Multiple follow-up encounters with statusHistory');
  }

  return followupEncounters[0];
};

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

// Loads the main (non-follow-up) encounter for an appointment plus the derived details used by the cancel flow.
export const getMainEncounterDetails = async (appointmentID: string, oystehr: Oystehr): Promise<EncounterDetails> => {
  let curStatusHistoryIdx, location, visitType, appointmentStart, patientID, canceledHistoryIdx;

  const encounter = await fetchMainEncounter(appointmentID, oystehr);

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
