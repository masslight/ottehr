import { AppointmentType, VisitStatusHistoryLabel } from 'utils';

export interface WaitingRoomInput {
  appointmentID: string;
  authorization: string | undefined;
}

export interface WaitingRoomResponse {
  appointmentType: AppointmentType;
  status: VisitStatusHistoryLabel;
  estimatedTime?: number;
  encounterId?: string;
}
