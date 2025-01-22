import { Appointment, Encounter, Patient, Practitioner, QuestionnaireResponse, Resource } from 'fhir/r4b';
import { AppointmentLocation, mapEncounterStatusHistory, TelemedCallStatuses } from 'utils';
import { mapStatusToTelemed, removePrefix } from '../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
import { getLocationIdFromAppointment } from './helpers';
import { mapQuestionnaireToEncountersIds, mapTelemedEncountersToAppointmentsIdsMap } from './mappers';
import { AppointmentPackage, LocationIdToAbbreviationMap } from './types';

export const filterLocationForAppointment = (
  appointment: Appointment,
  virtualLocationsMap: LocationIdToAbbreviationMap
): AppointmentLocation | undefined => {
  const locationId = getLocationIdFromAppointment(appointment);
  if (locationId) {
    const abbreviation = Object.keys(virtualLocationsMap).find((abbreviation) => {
      return virtualLocationsMap[abbreviation] === locationId;
    });
    return { locationID: locationId, state: abbreviation };
  }
  return undefined;
};

export const filterPatientForAppointment = (appointment: Appointment, allResources: Resource[]): Patient => {
  const patientId = appointment.participant
    .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');
  const patient = allResources.find((resourceTemp) => resourceTemp.id === patientId) as Patient;
  return patient;
};

const filterPractitionerForEncounter = (allResources: Resource[], encounter: Encounter): Practitioner | undefined => {
  console.log('encounter for my appoinement: ' + JSON.stringify(encounter));
  const practitionerRef = encounter.participant?.find((part) => part.individual?.reference?.includes('Practitioner/'))
    ?.individual?.reference;
  if (practitionerRef) {
    const practitionerId = removePrefix('Practitioner/', practitionerRef);
    return allResources.find((res) => res.id === practitionerId) as Practitioner;
  }
  return undefined;
};

export const filterAppointmentsFromResources = (
  allResources: Resource[],
  statusesFilter: TelemedCallStatuses[],
  virtualLocationsMap: LocationIdToAbbreviationMap
): AppointmentPackage[] => {
  const resultAppointments: AppointmentPackage[] = [];
  const appointmentEncounterMap: { [key: string]: Encounter } = mapTelemedEncountersToAppointmentsIdsMap(allResources);
  const encounterQuestionnaireMap: { [key: string]: QuestionnaireResponse } =
    mapQuestionnaireToEncountersIds(allResources);

  allResources.forEach((resource: Resource) => {
    const appointment = resource as Appointment;

    if (!(resource.resourceType === 'Appointment' && getVideoRoomResourceExtension(resource) && appointment.id)) {
      return;
    }
    if (!appointment.start) {
      console.log('No start time for appointment');
      return;
    }

    const encounter = appointmentEncounterMap[appointment.id!];
    if (encounter) {
      const telemedStatus = mapStatusToTelemed(encounter.status, appointment.status);
      const paperwork = encounterQuestionnaireMap[encounter.id!];

      if (telemedStatus && statusesFilter.includes(telemedStatus)) {
        const location = filterLocationForAppointment(appointment, virtualLocationsMap);
        const practitioner = filterPractitionerForEncounter(allResources, encounter);

        resultAppointments.push({
          appointment,
          paperwork,
          location,
          encounter,
          telemedStatus,
          practitioner,
          telemedStatusHistory: encounter.statusHistory
            ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
            : [],
        });
      }
    }
  });

  return resultAppointments;
};
