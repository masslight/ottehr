import { create } from 'zustand';

export interface WaitingRoomState {
  status: 'not_started' | 'started' | 'finished';
  estimatedTime?: number;
  encounterId?: string;
  videoRoomId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface WaitingRoomStoreActions {}

const WAITING_ROOM_STATE_INITIAL: WaitingRoomState = {
  status: 'not_started',
};

export const useWaitingRoomStore = create<WaitingRoomState & WaitingRoomStoreActions>()((_set) => ({
  ...WAITING_ROOM_STATE_INITIAL,
}));
