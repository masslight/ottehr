import { create } from 'zustand';
import { LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';

export interface VideoCallState {
  videoToken: string | null;
  isMicOpen: boolean;
  isVideoOpen: boolean;
  selectedSpeaker: string | null;
  room: Room | null;
  localTracks: (LocalAudioTrack | LocalVideoTrack)[];
}

interface VideoCallStoreActions {
  setIsMicOpen: (value: boolean) => void;
  setIsVideoOpen: (value: boolean) => void;
  setSelectedSpeaker: (value: string) => void;
  setLocalTracks: (value: (LocalAudioTrack | LocalVideoTrack)[]) => void;
}

const VIDEO_CALL_STATE_INITIAL: VideoCallState = {
  videoToken: null,
  isMicOpen: false,
  isVideoOpen: false,
  selectedSpeaker: null,
  room: null,
  localTracks: [],
};

export const useVideoCallStore = create<VideoCallState & VideoCallStoreActions>()((set) => ({
  ...VIDEO_CALL_STATE_INITIAL,
  setIsMicOpen: (value) => {
    set(() => ({
      isMicOpen: value,
    }));
  },
  setIsVideoOpen: (value) => {
    set(() => ({
      isVideoOpen: value,
    }));
  },
  setSelectedSpeaker: (value) => {
    set(() => ({
      selectedSpeaker: value,
    }));
  },
  setLocalTracks: (value) => {
    set(() => ({
      localTracks: value,
    }));
  },
}));
