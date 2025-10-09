import { AppointmentType, TelemedAppointmentStatus } from 'utils';

export interface WaitingRoomInput {
  appointmentID: string;
  authorization: string | undefined;
}

export interface WaitingRoomResponse {
  appointmentType: AppointmentType;
  status: TelemedAppointmentStatus;
  estimatedTime?: number;
  encounterId?: string;
}
