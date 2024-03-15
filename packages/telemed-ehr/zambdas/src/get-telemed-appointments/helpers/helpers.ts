import { Location, QuestionnaireResponse, Appointment } from 'fhir/r4';
import { AppointmentPackage, LocationIdToAbbreviationMap } from './types';
import { removePrefix } from '../../shared/appointment/helpers';

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
  virtualLocationsMap: LocationIdToAbbreviationMap,
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
    appointment.actor?.reference?.startsWith('Location/'),
  );
  const locationId = locationParticipant?.actor?.reference || '';
  return removePrefix('Location/', locationId);
};

export const groupAppointmentsLocations = (
  appointmentsPackages: AppointmentPackage[],
  virtualLocationsMap: LocationIdToAbbreviationMap,
  existedStatesGroups: string[][],
): string[][] => {
  const estimatedLocationsIdsGroups = convertStatesGroupsToIdsGroups(existedStatesGroups, virtualLocationsMap);
  const resultLocationsIdsGroups: string[][] = [];

  appointmentsPackages.forEach((pkg) => {
    const apptLocationId = pkg.location?.locationId;

    if (apptLocationId) {
      const locationInResult = resultLocationsIdsGroups.find((idsGroup) => idsGroup.includes(apptLocationId));
      if (!locationInResult) {
        const locationInExistedGroup = estimatedLocationsIdsGroups.find((idsGroup) =>
          idsGroup.includes(apptLocationId),
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
