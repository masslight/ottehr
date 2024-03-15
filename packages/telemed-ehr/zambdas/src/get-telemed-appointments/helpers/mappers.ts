import { mapStatusToTelemed, removePrefix, telemedStatusToEncounter } from '../../shared/appointment/helpers';
import {
  Encounter,
  EncounterStatusHistory,
  Resource,
  QuestionnaireResponse,
  RelatedPerson,
  Appointment,
} from 'fhir/r4';
import { TelemedStatusHistoryElement, TelemedCallStatuses, TelemedAppointmentInformation } from 'ehr-utils';
import { TwilioConversationModel, getVideoRoomResourceExtension } from '../../shared/helpers';
import { getLocationIdFromAppointment } from './helpers';
import { AppointmentToLocationIdMap, LocationIdToAbbreviationMap } from './types';

export const mapTelemedStatusToEncounter = (telemedStatuses: TelemedCallStatuses[]): string[] => {
  const statuses = telemedStatuses.map((status) => telemedStatusToEncounter(status));
  // removing duplications before returning
  return statuses.filter((status, index) => statuses.lastIndexOf(status) === index);
};

export const mapEncounterStatusHistory = (
  statusHistory: EncounterStatusHistory[],
  appointmentStatus: string,
): TelemedStatusHistoryElement[] => {
  const result: TelemedStatusHistoryElement[] = [];

  statusHistory.forEach((statusElement) => {
    result.push({
      start: statusElement.period.start,
      end: statusElement.period.end,
      status: mapStatusToTelemed(statusElement.status, undefined),
    });
  });
  if (appointmentStatus === 'fulfilled' && result.at(-1)?.status === 'unsigned') {
    result.push({
      start: result.at(-1)?.end,
      status: 'complete',
    });
  }

  return result;
};

export const mapEncountersToAppointmentsIds = (allResources: Resource[]): { [key: string]: Encounter } => {
  const appointmentEncounterMap: { [key: string]: Encounter } = {};
  // getting all encounters with virtual service extension used for video room
  // that have reference to appointments
  allResources.forEach((resource) => {
    if (!(resource.resourceType === 'Encounter' && getVideoRoomResourceExtension(resource))) return;

    const appointmentReference = (resource as Encounter)?.appointment?.[0].reference || '';
    const appointmentId = removePrefix('Appointment/', appointmentReference);
    if (appointmentId) {
      appointmentEncounterMap[appointmentId] = resource as Encounter;
    }
  });

  return appointmentEncounterMap;
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

export const mapAppointmentInformationToConversationModel = (
  appointments: TelemedAppointmentInformation[],
  relatedPersons: RelatedPerson[],
  conversationModels: TwilioConversationModel[],
): (TelemedAppointmentInformation & { conversationModel?: TwilioConversationModel })[] => {
  return appointments.map((app) => {
    const relatedPerson = relatedPersons.find((rp) => {
      const patientRef = rp.patient.reference;
      if (!patientRef) {
        console.log('conversationModel not found no patient ref!');
        return app;
      }
      return patientRef === `Patient/${app.patient.id}` && rp.id;
    });
    if (!relatedPerson?.id) {
      console.log('conversationModel not found!');
      return app;
    }
    const conversationModel = conversationModels.find((cv) => cv.relatedPersonParticipants.has(relatedPerson.id!));
    console.log('conversationModel', conversationModel);
    return {
      ...app,
      conversationModel,
    };
  });
};

export const mapAppointmentToLocationId = (appointments: Appointment[]): AppointmentToLocationIdMap => {
  const resultMap: AppointmentToLocationIdMap = {};
  appointments.forEach((appointment) => {
    const locationId = getLocationIdFromAppointment(appointment);
    if (locationId) resultMap[locationId] = appointment;
  });
  return resultMap;
};

export const mapStatesToLocationIds = (
  statesAbbreviations: string[],
  virtualLocationsMap: LocationIdToAbbreviationMap,
): string[] => {
  const resultIds: string[] = [];
  statesAbbreviations.forEach((abbreviation) => {
    const locationId = virtualLocationsMap[abbreviation];
    if (locationId) resultIds.push(locationId);
  });
  return resultIds;
};
