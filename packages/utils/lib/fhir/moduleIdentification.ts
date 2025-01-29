import { Appointment } from 'fhir/r4b';
// we should be able to get rid of this module tag entirely
export enum PROJECT_MODULE {
  IP = 'IN-PERSON',
  TM = 'TELEMEDICINE',
}

export const isInPersonAppointment = (appointment: Appointment): boolean => {
  const tags = appointment.meta?.tag ?? [];

  return tags.some((tag) => {
    return tag.code === PROJECT_MODULE.IP;
  });
};
