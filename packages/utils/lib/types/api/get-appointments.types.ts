import { InPersonAppointmentInformation } from '../data/appointments/appointments.types';
import { OrdersForTrackingBoardTable } from '../data/orders/types';
import { GetVitalsForListOfEncountersResponseData } from './chart-data/get-vitals.types';

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
  /** Every order on the in-office and discharged rows, keyed the way AppointmentTable reads it. */
  orders: OrdersForTrackingBoardTable;
  /** Abnormal (alertCriticality) vitals only, keyed by encounter id; only encounters with one appear. */
  vitals: GetVitalsForListOfEncountersResponseData;
  /**
   * Set when one or more of the order/vitals searches failed, so `orders` and `vitals` may be missing entries. The
   * appointment buckets are unaffected. The board keeps the previous tick's icons rather than blanking them.
   */
  ordersAndVitalsIncomplete?: boolean;
}
