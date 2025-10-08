import { Appointment } from 'fhir/r4b';

// we should be able to get rid of this module tag entirely
export enum OTTEHR_MODULE {
  IP = 'OTTEHR-IP',
  TM = 'OTTEHR-TM',
}

export const getAppointmentModuleType = (appointment?: Appointment): OTTEHR_MODULE | undefined => {
  for (const tag of appointment?.meta?.tag ?? []) {
    if (tag.code === OTTEHR_MODULE.IP) {
      return OTTEHR_MODULE.IP;
    }
    if (tag.code === OTTEHR_MODULE.TM) {
      return OTTEHR_MODULE.TM;
    }
  }

  return undefined;
};

export const isInPersonAppointment = (appointment?: Appointment): boolean => {
  return getAppointmentModuleType(appointment) === OTTEHR_MODULE.IP;
};

export const isTelemedAppointment = (appointment?: Appointment): boolean => {
  return getAppointmentModuleType(appointment) === OTTEHR_MODULE.TM;
};
