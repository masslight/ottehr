import { MeetingData } from 'ehr-utils';
import { create } from 'zustand';

export interface VideoCallState {
  meetingData: MeetingData | null;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  meetingData: null,
};

export const useVideoCallStore = create<VideoCallState>()(() => ({
  ...VIDEO_CALL_STATE_INITIAL,
}));
