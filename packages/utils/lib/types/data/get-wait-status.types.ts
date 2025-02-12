import { TelemedAppointmentStatus } from 'utils';

export interface WaitingRoomInput {
  appointmentID: string;
  authorization: string | undefined;
}

export interface WaitingRoomResponse {
  status: TelemedAppointmentStatus;
  estimatedTime?: number;
  encounterId?: string;
}
