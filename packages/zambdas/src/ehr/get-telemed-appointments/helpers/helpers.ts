import { Appointment, QuestionnaireResponse } from 'fhir/r4b';
import { TelemedCallStatuses } from 'utils';
import { removePrefix } from '../../../shared/appointment/helpers';

export const getPhoneNumberFromQuestionnaire = (questionnaire: QuestionnaireResponse): string | undefined => {
  const items = questionnaire.item;
  if (items) {
    const phoneNumberItem = items.find((item) => {
      return item.linkId === 'guardian-number';
    });
    return phoneNumberItem?.answer?.[0]?.valueString;
  }
  return undefined;
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
  const locationParticipant = appointment.participant.find(
    (appointment) => appointment.actor?.reference?.startsWith('Location/')
  );
  const locationId = locationParticipant?.actor?.reference || '';
  return removePrefix('Location/', locationId);
};

export const joinLocationsIdsForFhirSearch = (locationsIds: string[]): string => {
  return locationsIds.map((locationId) => 'Location/' + locationId).join(',');
};

export function telemedStatusToAppointment(telemedStatus: TelemedCallStatuses): string {
  switch (telemedStatus) {
    case 'ready':
      return 'arrived';
    case 'pre-video':
      return 'arrived';
    case 'on-video':
      return 'arrived';
    case 'unsigned':
      return 'arrived';
    case 'complete':
      return 'fulfilled';
    case 'cancelled':
      return 'cancelled';
  }
}
