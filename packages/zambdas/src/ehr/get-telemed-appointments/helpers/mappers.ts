import { Encounter, QuestionnaireResponse, Resource } from 'fhir/r4b';
import { TelemedCallStatuses } from 'utils';
import { removePrefix, telemedStatusToEncounter } from '../../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../../shared/helpers';
import { telemedStatusToAppointment } from './helpers';
import { LocationIdToStateAbbreviationMap } from './types';

export const mapTelemedStatusToEncounterAndAppointment = (
  telemedStatuses: TelemedCallStatuses[]
): { encounterStatuses: string[]; appointmentStatuses: string[] } => {
  const encounterStatuses: string[] = [];
  const appointmentStatuses: string[] = [];
  telemedStatuses.forEach((status) => {
    encounterStatuses.push(telemedStatusToEncounter(status));
    appointmentStatuses.push(telemedStatusToAppointment(status));
  });
  // removing duplications before returning
  return {
    encounterStatuses: encounterStatuses.filter((status, index) => encounterStatuses.lastIndexOf(status) === index),
    appointmentStatuses: appointmentStatuses.filter(
      (status, index) => appointmentStatuses.lastIndexOf(status) === index
    ),
  };
};

export const mapTelemedEncountersToAppointmentsIdsMap = (allResources: Resource[]): { [key: string]: Encounter } => {
  const appointmentEncounterMap: { [key: string]: Encounter } = {};
  // getting all encounters with virtual service extension used for video room
  // that have reference to appointments
  allResources.forEach((resource) => {
    const appointmentId = getTelemedEncounterAppointmentId(resource);
    if (appointmentId) {
      appointmentEncounterMap[appointmentId] = resource as Encounter;
    }
  });

  return appointmentEncounterMap;
};

export const getTelemedEncounterAppointmentId = (encounterResource: Resource): string | undefined => {
  if (!(encounterResource.resourceType === 'Encounter' && getVideoRoomResourceExtension(encounterResource)))
    return undefined;
  const appointmentReference = (encounterResource as Encounter)?.appointment?.[0].reference || '';
  const appointmentId = removePrefix('Appointment/', appointmentReference);

  return appointmentId;
};

export const mapQuestionnaireToEncountersIds = (allResources: Resource[]): { [key: string]: QuestionnaireResponse } => {
  const questionnaireAppointmentsMap: { [key: string]: QuestionnaireResponse } = {};

  allResources.forEach((resource) => {
    if (resource.resourceType === 'QuestionnaireResponse') {
      const questionnaire = resource as QuestionnaireResponse;
      const encounterReference = questionnaire.encounter?.reference;
      if (encounterReference) {
        const encounterId = removePrefix('Encounter/', encounterReference);
        if (encounterId) questionnaireAppointmentsMap[encounterId] = questionnaire;
      }
    }
  });
  return questionnaireAppointmentsMap;
};

export const mapStatesToLocationIds = (
  statesAbbreviations: string[],
  virtualLocationsMap: LocationIdToStateAbbreviationMap
): string[] => {
  const resultIds: string[] = [];
  statesAbbreviations.forEach((abbreviation) => {
    const locations = virtualLocationsMap[abbreviation];
    if (locations && locations.length > 0) {
      locations.forEach((location) => {
        resultIds.push(location.id!);
      });
    }
  });
  return resultIds;
};
