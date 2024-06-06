import { Location, QuestionnaireResponse, Appointment, RelatedPerson, Resource } from 'fhir/r4';
import { AppointmentPackage, LocationIdToAbbreviationMap, RelatedPersonMaps } from './types';
import { removePrefix } from '../../shared/appointment/helpers';
import { getChatContainsUnreadMessages, getSMSNumberForIndividual, SMSModel, SMSRecipient } from 'ehr-utils';

export const isLocationVirtual = (location: Location): boolean => {
  return location.extension?.[0].valueCoding?.code === 'vi';
};

export const getPhoneNumberFromQuestionnaire = (questionnaire: QuestionnaireResponse): string | undefined => {
  const items = questionnaire.item;
  if (items) {
    const phoneNumberItem = items.find((item) => {
      return item.linkId === 'guardian-number';
    });
    return phoneNumberItem?.answer?.[0].valueString;
  }
  return undefined;
};

export const convertStatesGroupsToIdsGroups = (
  estimatedTimeStatesGroups: string[][],
  virtualLocationsMap: LocationIdToAbbreviationMap
): string[][] => {
  const resultIdsGroups: string[][] = [];

  estimatedTimeStatesGroups.forEach((stateGroup) => {
    const idsGroup: string[] = [];

    stateGroup.forEach((stateAbbreviation) => {
      const stateLocationId = virtualLocationsMap[stateAbbreviation];
      if (stateLocationId) idsGroup.push(stateLocationId);
    });
    if (idsGroup.length > 0) resultIdsGroups.push(idsGroup);
  });
  return resultIdsGroups;
};

export const getAppointmentWaitingTime = (appointment: Appointment): number | undefined => {
  const rawDate = appointment.created;
  if (rawDate) {
    const apptDate = new Date(rawDate);
    const timeDifference = Math.abs(new Date().getTime() - apptDate.getTime());

    return timeDifference;
  }
  return undefined;
};

export const getLocationIdFromAppointment = (appointment: Appointment): string | undefined => {
  const locationParticipant = appointment.participant.find((appointment) =>
    appointment.actor?.reference?.startsWith('Location/')
  );
  const locationId = locationParticipant?.actor?.reference || '';
  return removePrefix('Location/', locationId);
};

export const groupAppointmentsLocations = (
  appointmentsPackages: AppointmentPackage[],
  virtualLocationsMap: LocationIdToAbbreviationMap,
  existedStatesGroups: string[][]
): string[][] => {
  const estimatedLocationsIdsGroups = convertStatesGroupsToIdsGroups(existedStatesGroups, virtualLocationsMap);
  const resultLocationsIdsGroups: string[][] = [];

  appointmentsPackages.forEach((pkg) => {
    const apptLocationId = pkg.location?.locationId;

    if (apptLocationId) {
      const locationInResult = resultLocationsIdsGroups.find((idsGroup) => idsGroup.includes(apptLocationId));
      if (!locationInResult) {
        const locationInExistedGroup = estimatedLocationsIdsGroups.find((idsGroup) =>
          idsGroup.includes(apptLocationId)
        );
        if (locationInExistedGroup) resultLocationsIdsGroups.push([...locationInExistedGroup]);
        else resultLocationsIdsGroups.push([apptLocationId]);
      }
    }
  });
  return resultLocationsIdsGroups;
};

export const joinLocationsIdsForFhirSearch = (locationsIds: string[]): string => {
  return locationsIds.map((locationId) => 'Location/' + locationId).join(',');
};

export function filterResources(allResources: Resource[], resourceType: string): Resource[] {
  return allResources.filter((res) => res.resourceType === resourceType && res.id);
}

export function getUniquePhonesNumbers(allRps: RelatedPerson[]): string[] {
  const uniquePhoneNumbers: string[] = [];

  allRps.forEach((rp) => {
    const phone = getSMSNumberForIndividual(rp);
    if (phone && !uniquePhoneNumbers.includes(phone)) uniquePhoneNumbers.push(phone);
  });

  return uniquePhoneNumbers;
}

export const createSmsModel = (patientId: string, allRelatedPersonMaps: RelatedPersonMaps): SMSModel | undefined => {
  let rps: RelatedPerson[] = [];
  try {
    rps = allRelatedPersonMaps.rpsToPatientIdMap[patientId];
    const recipients = filterValidRecipients(rps);
    if (recipients.length) {
      const allComs = recipients.flatMap((recip) => {
        return allRelatedPersonMaps.commsToRpRefMap[`RelatedPerson/${recip.relatedPersonId}`] ?? [];
      });
      return {
        hasUnreadMessages: getChatContainsUnreadMessages(allComs),
        recipients,
      };
    }
  } catch (e) {
    console.log('error building sms model: ', e);
    console.log('related persons value prior to error: ', rps);
  }
  return undefined;
};

function filterValidRecipients(relatedPersons: RelatedPerson[]): SMSRecipient[] {
  // some slack alerts suggest this could be undefined, but that would mean there are patients with no RP
  // or some bug preventing rp from being returned with the query
  return relatedPersons
    .map((rp) => {
      return {
        relatedPersonId: rp.id,
        smsNumber: getSMSNumberForIndividual(rp),
      };
    })
    .filter((rec) => rec.relatedPersonId !== undefined && rec.smsNumber !== undefined) as SMSRecipient[];
}
