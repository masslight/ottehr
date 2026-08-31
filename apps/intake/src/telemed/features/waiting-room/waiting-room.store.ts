import { zustandDevtools } from 'src/telemed/utils/zustandDevtools';
import { VisitStatusLabel } from 'utils/lib/types/api/appointment.types';
import { InvitedParticipantInfo } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { create } from 'zustand';

export interface WaitingRoomState {
  status: VisitStatusLabel;
  estimatedTime?: number;
  numberInLine?: number;
  encounterId?: string;
  videoRoomId?: string;
  invites?: InvitedParticipantInfo[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface WaitingRoomStoreActions {}

const WAITING_ROOM_STATE_INITIAL: WaitingRoomState = {
  status: 'ready',
};

export const useWaitingRoomStore = create<WaitingRoomState & WaitingRoomStoreActions>()((_set) => ({
  ...WAITING_ROOM_STATE_INITIAL,
}));

zustandDevtools('Telemed waiting room', useWaitingRoomStore);
