export interface InitTelemedSessionRequestParams {
  appointmentId: string;
  userId: string;
}

export interface InitTelemedSessionResponse {
  meetingData: MeetingData;
  encounterId: string;
}

export interface MeetingData {
  Attendee: object;
  Meeting: object;
}
