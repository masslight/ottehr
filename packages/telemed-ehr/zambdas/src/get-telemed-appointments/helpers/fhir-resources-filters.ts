import {
  Appointment,
  Patient,
  Resource,
  Encounter,
  QuestionnaireResponse,
  Practitioner,
  HealthcareService,
} from 'fhir/r4';
import { AppointmentLocation, TelemedCallStatuses } from 'ehr-utils';
import {
  mapEncountersToAppointmentsIds,
  mapEncounterStatusHistory,
  mapQuestionnaireToEncountersIds,
  mapIDToPractitioner,
  mapIDToHealthcareService,
} from './mappers';
import { mapStatusToTelemed } from '../../shared/appointment/helpers';
import { AppointmentPackage, LocationIdToAbbreviationMap } from './types';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
import { getLocationIdFromAppointment } from './helpers';
import { formatHumanName } from '@zapehr/sdk';

export const filterLocationForAppointment = (
  appointment: Appointment,
  virtualLocationsMap: LocationIdToAbbreviationMap,
): AppointmentLocation | undefined => {
  const locationID = getLocationIdFromAppointment(appointment);
  if (locationID) {
    const abbreviation = Object.keys(virtualLocationsMap).find((abbreviation) => {
      return virtualLocationsMap[abbreviation] === locationID;
    });
    return { locationID: locationID, state: abbreviation };
  }
  return undefined;
};

export const filterPatientForAppointment = (appointment: Appointment, allResources: Resource[]): Patient => {
  console.log('filtering patient for appointment', appointment);
  const patientId = appointment.participant
    .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');
  const patient = allResources.find((resourceTemp) => resourceTemp.id === patientId) as Patient;
  console.log('patient', patient);
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
  const practitionerIDs: { [key: string]: Practitioner } = mapIDToPractitioner(allResources);
  const healthcareServiceIDs: { [key: string]: HealthcareService } = mapIDToHealthcareService(allResources);

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
    const providers = appointment.participant
      .filter((participant) => participant.actor?.reference?.startsWith('Practitioner/'))
      .map(function (practitionerTemp) {
        if (!practitionerTemp.actor?.reference) {
          return;
        }
        const practitioner = practitionerIDs[practitionerTemp.actor.reference];
        if (!practitioner.name) {
          return;
        }
        console.log(2);
        return formatHumanName(practitioner.name[0]);
      })
      .filter((participant) => participant != undefined) as string[];
    const groups = appointment.participant
      .filter((participant) => participant.actor?.reference?.startsWith('HealthcareService/'))
      .map(function (healthcareServiceTemp) {
        if (!healthcareServiceTemp.actor?.reference) {
          return;
        }
        const healthcareService = healthcareServiceIDs[healthcareServiceTemp.actor.reference];
        if (!healthcareService.name) {
          return;
        }
        console.log(2);
        return healthcareService.name;
      })
      .filter((participant) => participant != undefined) as string[];
    if (encounter) {
      const telemedStatus = mapStatusToTelemed(encounter.status, appointment.status);
      const paperwork = encounterQuestionnaireMap[encounter.id!];

      if (telemedStatus && statusesFilter.includes(telemedStatus)) {
        const location = filterLocationForAppointment(appointment, virtualLocationsMap);

        resultAppointments.push({
          appointment,
          paperwork,
          location,
          providers: providers,
          groups: groups,
          encounter,
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
