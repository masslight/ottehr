import { MeetingData } from '../../data/telemed/join-call.types';

export interface InitTelemedSessionRequestParams {
  appointmentId: string;
  userId: string;
}

export interface InitTelemedSessionResponse {
  meetingData: MeetingData;
  encounterId: string;
}
