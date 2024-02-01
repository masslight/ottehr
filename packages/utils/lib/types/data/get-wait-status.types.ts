import { Secrets } from '../../main';

export interface WaitingRoomInput {
  appointmentID: string;
  secrets: Secrets | null;
  authorization: string | undefined;
}

export interface WaitingRoomResponse {
  status: 'not_started' | 'started' | 'finished';
  encounterId?: string;
  videoRoomId?: string;
}
