import { Patient, Appointment } from 'fhir/r4';

export enum PROJECT_MODULE {
  UC = 'OTTEHR-UC',
  BH = 'OTTEHR-BH',
  TM = 'OTTEHR-TM',
}

export const isUrgentCareAppointment = (appointment: Appointment): boolean => {
  const tags = appointment.meta?.tag ?? [];

  return tags.some((tag) => {
    return tag.code === PROJECT_MODULE.UC;
  });
};

export const isBHResource = (resource: Appointment | Patient): boolean => {
  const tags = resource.meta?.tag ?? [];

  return tags.some((tag) => {
    return tag.code === PROJECT_MODULE.BH;
  });
};
