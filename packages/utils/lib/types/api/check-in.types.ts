import { AvailableLocationInformation } from '../common';
import { VisitType } from '../data/telemed/appointments/create-appointment.types';

export interface CheckInInput {
  appointmentId: string;
}

export interface CheckInZambdaOutput {
  location: AvailableLocationInformation;
  visitType: VisitType;
  start: string;
  paperworkCompleted: boolean;
}
