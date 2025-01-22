import { create } from 'zustand';
import { TelemedAppointmentStatus, InvitedParticipantInfo } from 'ottehr-utils';

export interface WaitingRoomState {
  status: TelemedAppointmentStatus;
  estimatedTime?: number;
  encounterId?: string;
  videoRoomId?: string;
  invites?: InvitedParticipantInfo[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface WaitingRoomStoreActions {}

const WAITING_ROOM_STATE_INITIAL: WaitingRoomState = {
  status: 'ready',
};

export const useWaitingRoomStore = create<WaitingRoomState & WaitingRoomStoreActions>()((_set) => ({
  ...WAITING_ROOM_STATE_INITIAL,
}));
