import { InPersonAppointmentInformation } from '..';

export interface GetAppointmentsZambdaInput {
  searchDate: string;
  locationID?: string;
  providerIDs?: string[];
  groupIDs?: string[];
  visitType: string[];
}

export interface GetAppointmentsZambdaOutput {
  activeApptDatesBeforeToday: string[];
  message: string;
  preBooked: InPersonAppointmentInformation[];
  inOffice: InPersonAppointmentInformation[];
  completed: InPersonAppointmentInformation[];
  cancelled: InPersonAppointmentInformation[];
}
