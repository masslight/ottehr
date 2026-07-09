import { MeetingData } from 'utils';
import { create } from 'zustand';

export interface VideoCallState {
  meetingData: MeetingData | null;
  // Set once the provider has ended the meeting via oystehr.telemed.endMeeting. The meeting is
  // permanently ended for all participants and cannot be rejoined.
  wasMeetingEnded: boolean;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  meetingData: null,
  wasMeetingEnded: false,
};

export const useVideoCallStore = create<VideoCallState>()(() => ({
  ...VIDEO_CALL_STATE_INITIAL,
}));
