import { InPersonAppointmentInformation } from '..';

export interface GetAppointmentsZambdaInput {
  searchDate: string;
  locationID?: string;
  providerIDs?: string[];
  serviceCategories?: string[];
  visitType: string[];
  supervisorApprovalEnabled?: boolean;
}

export interface GetAppointmentsZambdaOutput {
  message: string;
  preBooked: InPersonAppointmentInformation[];
  inOffice: InPersonAppointmentInformation[];
  completed: InPersonAppointmentInformation[];
  cancelled: InPersonAppointmentInformation[];
}
