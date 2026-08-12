import { zustandDevtools } from 'src/telemed/utils/zustandDevtools';
import { MeetingData } from 'utils/lib/types/data/telemed/join-call.types';
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

zustandDevtools('Telemed video call', useVideoCallStore);
