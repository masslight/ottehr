import { AvailableLocationInformation, VisitType } from '..';

export interface CheckInInput {
  appointmentId: string;
}

export interface CheckInZambdaOutput {
  location: AvailableLocationInformation;
  visitType: VisitType;
  start: string;
  paperworkCompleted: boolean;
}
