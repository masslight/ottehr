import { MeetingData } from 'utils';
import { create } from 'zustand';

export interface VideoCallState {
  meetingData: MeetingData | null;
  // Incremented each time the provider ends a call via oystehr.telemed.endMeeting. A provider can start a
  // new call afterwards (a fresh Chime room on the same encounter), so this is a per-call counter rather
  // than a terminal flag. It drives the Ambient Scribe suggestions polling to re-run for every call.
  endedCallCount: number;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  meetingData: null,
  endedCallCount: 0,
};

export const useVideoCallStore = create<VideoCallState>()(() => ({
  ...VIDEO_CALL_STATE_INITIAL,
}));
