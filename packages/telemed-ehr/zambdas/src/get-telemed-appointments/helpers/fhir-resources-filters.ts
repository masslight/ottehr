import { Appointment, Patient, Resource, Encounter, QuestionnaireResponse } from 'fhir/r4';
import { AppointmentLocation, TelemedCallStatuses } from 'ehr-utils';
import { mapEncountersToAppointmentsIds, mapEncounterStatusHistory, mapQuestionnaireToEncountersIds } from './mappers';
import { mapStatusToTelemed } from '../../shared/appointment/helpers';
import { AppointmentPackage, LocationIdToAbbreviationMap } from './types';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
import { getLocationIdFromAppointment } from './helpers';

export const filterLocationForAppointment = (
  appointment: Appointment,
  virtualLocationsMap: LocationIdToAbbreviationMap,
): AppointmentLocation | undefined => {
  const locationId = getLocationIdFromAppointment(appointment);
  if (locationId) {
    const abbreviation = Object.keys(virtualLocationsMap).find((abbreviation) => {
      return virtualLocationsMap[abbreviation] === locationId;
    });
    return { locationId: locationId, state: abbreviation };
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

export const filterAppointmentsFromResources = (
  allResources: Resource[],
  statusesFilter: TelemedCallStatuses[],
  virtualLocationsMap: LocationIdToAbbreviationMap,
): AppointmentPackage[] => {
  const resultAppointments: AppointmentPackage[] = [];
  const appointmentEncounterMap: { [key: string]: Encounter } = mapEncountersToAppointmentsIds(allResources);
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

        resultAppointments.push({
          appointment,
          paperwork,
          location,
          telemedStatus,
          telemedStatusHistory: encounter.statusHistory
            ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
            : [],
        });
      }
    }
  });

  return resultAppointments;
};
