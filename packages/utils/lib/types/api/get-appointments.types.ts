import { InPersonAppointmentInformation } from '..';

export interface GetAppointmentsZambdaInput {
  searchDate: string;
  timezone: string;
  locationIds?: string[];
  providerIds?: string[];
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
