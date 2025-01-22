import { MeetingData } from '../../../main';

export interface InitTelemedSessionRequestParams {
  appointmentId: string;
  userId: string;
}

export interface InitTelemedSessionResponse {
  meetingData: MeetingData;
  encounterId: string;
}
