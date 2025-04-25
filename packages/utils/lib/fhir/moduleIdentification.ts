import { Appointment } from 'fhir/r4b';
// we should be able to get rid of this module tag entirely
export enum OTTEHR_MODULE {
  IP = 'OTTEHR-IP',
  TM = 'OTTEHR-TM',
}

export const isInPersonAppointment = (appointment: Appointment): boolean => {
  const tags = appointment.meta?.tag ?? [];

  return tags.some((tag) => {
    return tag.code === OTTEHR_MODULE.IP;
  });
};
