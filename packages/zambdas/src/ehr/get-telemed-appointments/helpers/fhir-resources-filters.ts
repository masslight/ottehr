import { Appointment, Encounter, Patient, Practitioner, QuestionnaireResponse, Resource } from 'fhir/r4b';
import {
  AppointmentLocation,
  appointmentTypeForAppointment,
  isTruthy,
  mapEncounterStatusHistory,
  TelemedCallStatuses,
} from 'utils';
import { mapStatusToTelemed, removePrefix } from '../../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../../shared/helpers';
import { getLocationIdFromAppointment } from './helpers';
import { mapQuestionnaireToEncountersIds, mapTelemedEncountersToAppointmentsIdsMap } from './mappers';
import { AppointmentPackage, LocationIdToStateAbbreviationMap } from './types';

export const findVirtualLocationForAppointment = (
  appointment: Appointment,
  virtualLocationsMap: LocationIdToStateAbbreviationMap
): AppointmentLocation | undefined => {
  const locationId = getLocationIdFromAppointment(appointment);
  if (locationId) {
    const stateAbbreviation = Object.keys(virtualLocationsMap).find((abbreviation) => {
      return virtualLocationsMap[abbreviation].find((location) => location.id === locationId);
    });
    if (!stateAbbreviation) {
      console.error('No state abbreviation found for location', locationId);
      return undefined;
    }
    const location = virtualLocationsMap[stateAbbreviation].find((location) => location.id === locationId)!;
    return {
      reference: locationId ? `Location/${locationId}` : undefined,
      name: location.name,
      state: stateAbbreviation,
      resourceType: 'Location',
      id: locationId,
      extension: location.extension,
    };
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
  // console.log('encounter for appointment: ' + JSON.stringify(encounter));
  const practitionerRef = encounter.participant?.find((part) => part.individual?.reference?.includes('Practitioner/'))
    ?.individual?.reference;
  if (practitionerRef) {
    const practitionerId = removePrefix('Practitioner/', practitionerRef);
    return allResources.find((res) => res.id === practitionerId) as Practitioner;
  }
  return undefined;
};

export const filterAppointmentsAndCreatePackages = ({
  allResources,
  statusesFilter,
  virtualLocationsMap,
  visitTypes,
  locationsIdsFilter,
}: {
  allResources: Resource[];
  statusesFilter: TelemedCallStatuses[];
  virtualLocationsMap: LocationIdToStateAbbreviationMap;
  visitTypes?: string[];
  locationsIdsFilter?: string[];
}): AppointmentPackage[] => {
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

    // add location filtering
    const apptLocationIds = appointment.participant
      ?.filter((part) => part.actor?.reference?.includes('Location/'))
      .map((part) => part?.actor?.reference?.split('/')[1])
      .filter(isTruthy);

    if (locationsIdsFilter && !apptLocationIds.some((id) => locationsIdsFilter.includes(id))) {
      return;
    }

    console.log('visitTypes', visitTypes);
    console.log('type in appt', appointment.appointmentType, appointmentTypeForAppointment(appointment));
    // add visit type filtering
    if (visitTypes && visitTypes.length > 0 && !visitTypes?.includes(appointmentTypeForAppointment(appointment))) {
      return;
    }

    const encounter = appointmentEncounterMap[appointment.id!];
    if (encounter) {
      const telemedStatus = mapStatusToTelemed(encounter.status, appointment.status);
      const paperwork = encounterQuestionnaireMap[encounter.id!];

      if (telemedStatus && statusesFilter.includes(telemedStatus)) {
        const locationVirtual = findVirtualLocationForAppointment(appointment, virtualLocationsMap);
        const practitioner = filterPractitionerForEncounter(allResources, encounter);

        if (!locationVirtual) {
          console.error('No location for appointment', appointment.id);
          return;
        }

        resultAppointments.push({
          appointment,
          paperwork,
          locationVirtual,
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
