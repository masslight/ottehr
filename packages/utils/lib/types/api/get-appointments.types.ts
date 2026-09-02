import { InPersonAppointmentInformation } from '../data/appointments/appointments.types';
import { OrdersForTrackingBoardTable } from '../data/orders/types';
import { GetVitalsForListOfEncountersResponseData } from './chart-data/get-vitals.types';

/**
 * Transitional (tracking board consolidation, phases 1 and 2): opts the response into the tracking
 * board's grouped order and abnormal-vitals maps. Absent means today's appointments-only response,
 * byte for byte. Phase 3 removes the flag and always returns both maps.
 */
export interface GetAppointmentsInclude {
  orders?: boolean;
  vitals?: boolean;
}

export interface GetAppointmentsZambdaInput {
  searchDateFrom: string;
  searchDateTo: string;
  timezone: string;
  locationIds?: string[];
  providerIds?: string[];
  serviceCategories?: string[];
  visitType: string[];
  supervisorApprovalEnabled?: boolean;
  include?: GetAppointmentsInclude;
}

export interface GetAppointmentsZambdaOutput {
  message: string;
  preBooked: InPersonAppointmentInformation[];
  inOffice: InPersonAppointmentInformation[];
  completed: InPersonAppointmentInformation[];
  cancelled: InPersonAppointmentInformation[];
  /** Present only when `include.orders` was requested; keyed the way AppointmentTable reads it. */
  orders?: OrdersForTrackingBoardTable;
  /** Present only when `include.vitals` was requested; abnormal (alertCriticality) entries only. */
  vitals?: GetVitalsForListOfEncountersResponseData;
}
