import { InvitedParticipantInfo, TelemedAppointmentStatus } from 'utils';
import { create } from 'zustand';
import { zustandDevtools } from '../../utils';

export interface WaitingRoomState {
  status: TelemedAppointmentStatus;
  estimatedTime?: number;
  numberInLine?: number;
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

zustandDevtools('Telemed waiting room', useWaitingRoomStore);
