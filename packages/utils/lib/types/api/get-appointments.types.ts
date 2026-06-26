import { InPersonAppointmentInformation } from '..';

export interface GetAppointmentsZambdaInput {
  searchDateFrom: string;
  searchDateTo: string;
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
