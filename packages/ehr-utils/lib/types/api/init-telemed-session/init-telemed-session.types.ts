export interface InitTelemedSessionRequestParams {
  appointmentId: string;
  userId: string;
}

export interface InitTelemedSessionResponse {
  videoToken: string;
  videoRoomId: string;
  encounterId: string;
}
