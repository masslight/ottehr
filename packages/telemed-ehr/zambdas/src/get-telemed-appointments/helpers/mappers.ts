import {
  Appointment,
  Communication,
  Encounter,
  HealthcareService,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import { getSMSNumberForIndividual, TelemedCallStatuses } from 'ehr-utils';
import { removePrefix, telemedStatusToEncounter } from '../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
import { filterResources, getLocationIdFromAppointment, getUniquePhonesNumbers } from './helpers';
import { AppointmentToLocationIdMap, LocationIdToAbbreviationMap, RelatedPersonMaps } from './types';
import { FhirClient } from '@zapehr/sdk';
import { getCommunicationsAndSenders } from './fhir-utils';

export const mapTelemedStatusToEncounter = (telemedStatuses: TelemedCallStatuses[]): string[] => {
  const statuses = telemedStatuses.map((status) => telemedStatusToEncounter(status));
  // removing duplications before returning
  return statuses.filter((status, index) => statuses.lastIndexOf(status) === index);
};

export { mapEncounterStatusHistory } from 'ehr-utils';

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

export const mapIDToPractitioner = (allResources: Resource[]): { [key: string]: Practitioner } => {
  const practitionerIDs: { [key: string]: Practitioner } = {};

  allResources.forEach((resource) => {
    if (resource.resourceType === 'Practitioner' && resource.id) {
      const practitioner = resource as Practitioner;
      practitionerIDs[`Practitioner/${resource.id}`] = practitioner;
    }
  });
  return practitionerIDs;
};

export const mapIDToHealthcareService = (allResources: Resource[]): { [key: string]: HealthcareService } => {
  const healthcareServiceIDs: { [key: string]: HealthcareService } = {};

  allResources.forEach((resource) => {
    if (resource.resourceType === 'HealthcareService' && resource.id) {
      const healthcareService = resource as HealthcareService;
      healthcareServiceIDs[`HealthcareService/${resource.id}`] = healthcareService;
    }
  });
  return healthcareServiceIDs;
};

// export const mapAppointmentInformationToConversationModel = (
//   appointments: TelemedAppointmentInformation[],
//   relatedPersons: RelatedPerson[],
//   conversationModels: TwilioConversationModel[]
// ): (TelemedAppointmentInformation & { conversationModel?: TwilioConversationModel })[] => {
//   return appointments.map((app) => {
//     const relatedPerson = relatedPersons.find((rp) => {
//       const patientRef = rp.patient.reference;
//       if (!patientRef) {
//         console.log('conversationModel not found no patient ref!');
//         return app;
//       }
//       return patientRef === `Patient/${app.patient.id}` && rp.id;
//     });
//     if (!relatedPerson?.id) {
//       console.log('conversationModel not found!');
//       return app;
//     }
//     const conversationModel = conversationModels.find((cv) => cv.relatedPersonParticipants.has(relatedPerson.id!));
//     console.log('conversationModel', conversationModel);
//     return {
//       ...app,
//       conversationModel,
//     };
//   });
// };

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

export const relatedPersonAndCommunicationMaps = async (
  fhirClient: FhirClient,
  inputResources: Resource[],
): Promise<RelatedPersonMaps> => {
  const allRelatedPersons = filterResources(inputResources, 'RelatedPerson') as RelatedPerson[];

  const rpsPhoneNumbers = getUniquePhonesNumbers(allRelatedPersons);
  const rpsToPatientIdMap = mapRelatedPersonToPatientId(allRelatedPersons);
  const rpToIdMap = mapRelatedPersonToId(allRelatedPersons);

  const foundResources = await getCommunicationsAndSenders(fhirClient, rpsPhoneNumbers);
  const foundRelatedPersons = filterResources(foundResources, 'RelatedPerson') as RelatedPerson[];
  Object.assign(rpToIdMap, mapRelatedPersonToId(foundRelatedPersons));
  rpsPhoneNumbers.concat(getUniquePhonesNumbers(foundRelatedPersons)); // do better here
  const rpsRefsToPhoneNumberMap = mapRelatedPersonsRefsToPhoneNumber(foundRelatedPersons);

  const foundCommunications = filterResources(foundResources, 'Communication') as Communication[];
  const commsToRpRefMap = mapCommunicationsToRelatedPersonRef(foundCommunications, rpToIdMap, rpsRefsToPhoneNumberMap);

  return {
    rpsToPatientIdMap,
    commsToRpRefMap,
  };
};

function mapRelatedPersonToPatientId(allRps: RelatedPerson[]): Record<string, RelatedPerson[]> {
  const rpsToPatientIdMap: Record<string, RelatedPerson[]> = {};

  allRps.forEach((rp) => {
    const patientId = removePrefix('Patient/', rp.patient.reference || '');
    if (patientId) {
      if (rpsToPatientIdMap[patientId]) rpsToPatientIdMap[patientId].push(rp);
      else rpsToPatientIdMap[patientId] = [rp];
    }
  });

  return rpsToPatientIdMap;
}

function mapRelatedPersonToId(allRps: RelatedPerson[]): Record<string, RelatedPerson> {
  const rpToIdMap: Record<string, RelatedPerson> = {};

  allRps.forEach((rp) => {
    rpToIdMap['RelatedPerson/' + rp.id] = rp;
  });

  return rpToIdMap;
}

function mapRelatedPersonsRefsToPhoneNumber(allRps: RelatedPerson[]): Record<string, string[]> {
  const relatedPersonRefToPhoneNumber: Record<string, string[]> = {};

  allRps.forEach((rp) => {
    const rpRef = `RelatedPerson/${rp.id}`;
    const pn = getSMSNumberForIndividual(rp as RelatedPerson);
    if (pn) {
      if (relatedPersonRefToPhoneNumber[pn]) relatedPersonRefToPhoneNumber[pn].push(rpRef);
      else relatedPersonRefToPhoneNumber[pn] = [rpRef];
    }
  });
  return relatedPersonRefToPhoneNumber;
}

function mapCommunicationsToRelatedPersonRef(
  allCommunications: Communication[],
  rpToIdMap: Record<string, RelatedPerson>,
  rpsRefsToPhoneNumberMap: Record<string, string[]>,
): Record<string, Communication[]> {
  const commsToRpRefMap: Record<string, Communication[]> = {};

  allCommunications.forEach((comm) => {
    const communication = comm as Communication;
    const rpRef = communication.sender?.reference;
    if (rpRef) {
      const senderResource = rpToIdMap[rpRef];
      if (senderResource) {
        const smsNumber = getSMSNumberForIndividual(senderResource);
        if (smsNumber) {
          const allRPsWithThisNumber = rpsRefsToPhoneNumberMap[smsNumber];
          allRPsWithThisNumber.forEach((rpRef) => {
            if (commsToRpRefMap[rpRef]) commsToRpRefMap[rpRef].push(communication);
            else commsToRpRefMap[rpRef] = [communication];
          });
        }
      }
    }
  });

  return commsToRpRefMap;
}
