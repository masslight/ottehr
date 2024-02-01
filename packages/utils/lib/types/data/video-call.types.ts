export interface GetWaitStatusParams {
  appointmentID: string;
}

export interface GetWaitStatusResponse {
  status: 'not_started' | 'started' | 'finished';
  encounterId?: string;
  videoRoomId?: string;
}
