import { MeetingData } from 'utils/lib/types/data/telemed/join-call.types';
import { create } from 'zustand';

export type VirtualBackgroundSetting = { mode: 'none' } | { mode: 'blur' } | { mode: 'image'; imageBlob: Blob };

export interface VideoCallState {
  meetingData: MeetingData | null;
  // Incremented each time the provider ends a call via oystehr.telemed.endMeeting. A provider can start a
  // new call afterwards (a fresh Chime room on the same encounter), so this is a per-call counter rather
  // than a terminal flag. It drives the Ambient Scribe suggestions polling to re-run for every call.
  endedCallCount: number;
  virtualBackground: VirtualBackgroundSetting;
  // Device IDs chosen in the pre-call settings dialog. Applied by VideoChatContainer on call start.
  preferredVideoDeviceId: string | null;
  preferredAudioDeviceId: string | null;
  // Plain camera device ID currently in use (may differ from selectedDevice in useVideoInputs()
  // which returns the DefaultVideoTransformDevice when blur/background is active).
  currentRawVideoDeviceId: string | null;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  meetingData: null,
  endedCallCount: 0,
  virtualBackground: { mode: 'none' },
  preferredVideoDeviceId: null,
  preferredAudioDeviceId: null,
  currentRawVideoDeviceId: null,
};

export const useVideoCallStore = create<VideoCallState>()(() => ({
  ...VIDEO_CALL_STATE_INITIAL,
}));
