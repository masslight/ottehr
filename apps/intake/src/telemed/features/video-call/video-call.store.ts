import { MeetingData } from 'utils';
import { create } from 'zustand';
import { zustandDevtools } from '../../utils';

export interface VideoCallState {
  meetingData: MeetingData | null;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  meetingData: null,
};

export const useVideoCallStore = create<VideoCallState>()(() => ({
  ...VIDEO_CALL_STATE_INITIAL,
}));

zustandDevtools('Telemed video call', useVideoCallStore);
